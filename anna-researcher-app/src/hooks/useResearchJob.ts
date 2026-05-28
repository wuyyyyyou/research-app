import { useCallback, useEffect, useRef, useState } from "react";
import type { ResearchApi } from "../api/researchApi";
import type {
  IterationEntry,
  ResearchJob,
  ResearchPhase,
  ResearchResult,
  ResearchSourceTestResult,
  ResearchSourceView,
  ToolSettings,
} from "../types";

export const MAX_RESEARCH_ITERATIONS = 5;

interface DecideCallSource {
  type: "call_source";
  source_id?: string;
  queries: string[];
}

interface DecideFinish {
  type: "finish";
  reason?: string;
}

type Decision = DecideCallSource | DecideFinish;

export function useResearchJob(api: ResearchApi) {
  const [job, setJob] = useState<ResearchJob | null>(null);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [settings, setSettings] = useState<ToolSettings | null>(null);
  const [sources, setSources] = useState<ResearchSourceView[]>([]);
  const [phase, setPhase] = useState<ResearchPhase>("idle");
  const [error, setError] = useState<unknown>(null);
  const runIdRef = useRef(0);

  const refreshSources = useCallback(async () => {
    const next = await api.listResearchSources();
    setSources(next);
    return next;
  }, [api]);

  const refreshSettings = useCallback(async () => {
    const [nextSettings, nextSources] = await Promise.all([api.getSettings(), api.listResearchSources()]);
    setSettings(nextSettings);
    setSources(nextSources);
    if (!hasConfiguredSource(nextSources)) setPhase("settings_required");
    return { settings: nextSettings, sources: nextSources };
  }, [api]);

  useEffect(() => {
    let cancelled = false;
    async function loadInitial() {
      try {
        const [nextSettings, nextSources] = await Promise.all([api.getSettings(), api.listResearchSources()]);
        if (cancelled) return;
        setSettings(nextSettings);
        setSources(nextSources);
        const latest = await api.getResearchJob();
        if (cancelled) return;
        const ready = hasConfiguredSource(nextSources);
        if (latest) {
          setJob(latest);
          if (latest.result) {
            setResult(latest.result);
            setPhase(latest.status === "completed" ? "completed" : "idle");
          } else {
            setPhase(ready ? "idle" : "settings_required");
          }
        } else {
          setPhase(ready ? "idle" : "settings_required");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err);
          setPhase("failed");
        }
      }
    }
    void loadInitial();
    return () => {
      cancelled = true;
    };
  }, [api]);

  const applySourceUpdate = useCallback(
    (next: ResearchSourceView) => {
      const updated = sources.map((source) => (source.id === next.id ? next : source));
      if (!updated.some((source) => source.id === next.id)) updated.push(next);
      setSources(updated);
      const ready = hasConfiguredSource(updated);
      setPhase(ready ? "idle" : "settings_required");
      return updated;
    },
    [sources],
  );

  const updateSourceCredential = useCallback(
    async (input: { id: string; credential?: string; clear?: boolean }) => {
      const next = await api.updateResearchSourceCredential(input);
      applySourceUpdate(next);
      return next;
    },
    [api, applySourceUpdate],
  );

  const setSourceEnabled = useCallback(
    async (input: { id: string; enabled: boolean }) => {
      const next = await api.setResearchSourceEnabled(input);
      applySourceUpdate(next);
      return next;
    },
    [api, applySourceUpdate],
  );

  const upsertSource = useCallback(
    async (input: { definition: Record<string, unknown>; credential?: string }) => {
      const next = await api.upsertResearchSource(input);
      applySourceUpdate(next);
      return next;
    },
    [api, applySourceUpdate],
  );

  const deleteSource = useCallback(
    async (input: { id: string }) => {
      const result = await api.deleteResearchSource(input);
      const remaining = sources.filter((source) => source.id !== input.id);
      setSources(remaining);
      const ready = hasConfiguredSource(remaining);
      setPhase(ready ? "idle" : "settings_required");
      return result;
    },
    [api, sources],
  );

  const testSource = useCallback(
    async (input: { id: string; definition: Record<string, unknown>; query: string }): Promise<ResearchSourceTestResult> => {
      return api.testResearchSource(input);
    },
    [api],
  );

  const start = useCallback(
    async (query: string) => {
      const runId = runIdRef.current + 1;
      runIdRef.current = runId;
      setPhase("starting");
      setError(null);
      setResult(null);
      try {
        const current = await refreshSettings();
        if (!hasConfiguredSource(current.sources)) {
          setPhase("settings_required");
          return;
        }
        let job = await api.createResearchJob({ query });
        if (runId !== runIdRef.current) return;
        setJob(job);
        setPhase("running");

        job = await updateJob(api, job, { status: "running", stage: "select_role", progress: 10 });
        setJob(job);
        const role = await selectRole(api, query);
        const enabledSources = readyEnabledSources(current.sources);
        if (enabledSources.length === 0) throw new Error("No enabled research source is configured.");
        const enabledSourceIds = enabledSources.map((source) => source.id);
        const defaultSourceId = enabledSourceIds[0];

        job = await updateJob(api, job, {
          agent_name: role.agent_name,
          agent_role_prompt: role.agent_role_prompt,
          stage: "decide_next_action",
          iteration: 0,
          max_iterations: MAX_RESEARCH_ITERATIONS,
          enabled_sources: enabledSourceIds,
          progress: 20,
        });
        setJob(job);
        if (runId !== runIdRef.current) return;

        const calledNormalized = new Map<string, Set<string>>();
        const localIterations: IterationEntry[] = [];

        for (let iteration = 1; iteration <= MAX_RESEARCH_ITERATIONS; iteration++) {
          job = await updateJob(api, job, {
            stage: "decide_next_action",
            iteration,
            progress: progressForIteration(iteration),
          });
          setJob(job);
          if (runId !== runIdRef.current) return;

          const decision = await decideNextAction({
            api,
            query,
            rolePrompt: role.agent_role_prompt,
            iteration,
            maxIterations: MAX_RESEARCH_ITERATIONS,
            enabledSources,
            history: localIterations,
          });
          if (decision.type !== "call_source") break;

          const requestedSourceId = decision.source_id && enabledSourceIds.includes(decision.source_id)
            ? decision.source_id
            : defaultSourceId;
          const seenForSource = calledNormalized.get(requestedSourceId) ?? new Set<string>();
          const newQueries = uniqueNewQueries(decision.queries, seenForSource);
          calledNormalized.set(requestedSourceId, seenForSource);
          if (newQueries.length === 0) break;

          job = await updateJob(api, job, {
            stage: "search_next_query",
            iteration,
            search_index: iteration,
            search_total: MAX_RESEARCH_ITERATIONS,
            progress: progressForIteration(iteration) + 5,
          });
          setJob(job);

          const call = await api.callResearchSource({
            research_id: requiredResearchId(job),
            iteration,
            source_id: requestedSourceId,
            queries: newQueries,
          });
          if (call.job) job = call.job;
          if (call.source_call) {
            localIterations.push({
              iteration,
              source_id: call.source_call.source_id,
              source_name: call.source_call.source_name,
              queries: call.source_call.queries,
              results_count: call.source_call.results_count,
              source_calls: call.source_call.calls,
            });
          }
          setJob(job);
          if (runId !== runIdRef.current) return;
        }

        job = await updateJob(api, job, { stage: "select_context", progress: 88 });
        setJob(job);

        const selected = await api.selectContext({ research_id: requiredResearchId(job) });
        if (selected.job) job = selected.job;
        setJob({ ...job, stage: "write_report", progress: 94 });

        const report = await writeReport(
          api,
          query,
          role.agent_role_prompt,
          selected.selected_context || job.selected_context || "",
        );
        const transfer = await api.saveResearchResult({ research_id: requiredResearchId(job) });
        const saved = await api.uploadResearchResult(transfer, {
          report_markdown: report,
          source_urls: selected.source_urls || job.source_urls || [],
        });
        if (saved.job) job = saved.job;
        setJob(job);
        setResult(saved.result || job.result || null);
        setPhase("completed");
      } catch (err) {
        setError(err);
        setPhase("failed");
      }
    },
    [api, refreshSettings],
  );

  return {
    job,
    result,
    settings,
    sources,
    phase,
    error,
    isBusy: phase === "starting" || phase === "running" || phase === "loading_result",
    canStart: hasConfiguredSource(sources),
    refreshSettings,
    refreshSources,
    updateSourceCredential,
    setSourceEnabled,
    upsertSource,
    deleteSource,
    testSource,
    start,
  };
}

function hasConfiguredSource(sources: ResearchSourceView[]): boolean {
  return sources.some((source) => source.enabled && source.credential_status === "configured");
}

function readyEnabledSources(sources: ResearchSourceView[]): ResearchSourceView[] {
  return sources.filter((source) => source.enabled && source.credential_status === "configured");
}

async function updateJob(api: ResearchApi, job: ResearchJob, updates: Record<string, unknown>): Promise<ResearchJob> {
  return api.updateResearchJob(requiredResearchId(job), updates);
}

function requiredResearchId(job: ResearchJob): string {
  if (!job.research_id) throw new Error("Research job is missing research_id.");
  return job.research_id;
}

function progressForIteration(iteration: number): number {
  return Math.min(80, 25 + iteration * 12);
}

function normalizeForDedup(query: string): string {
  return query.toLowerCase().split(/\s+/).filter(Boolean).join(" ");
}

function uniqueNewQueries(queries: unknown, called: Set<string>): string[] {
  if (!Array.isArray(queries)) return [];
  const out: string[] = [];
  for (const raw of queries) {
    const text = String(raw || "").trim();
    if (!text) continue;
    const norm = normalizeForDedup(text);
    if (!norm || called.has(norm)) continue;
    called.add(norm);
    out.push(text.slice(0, 180));
    if (out.length >= 3) break;
  }
  return out;
}

async function selectRole(api: ResearchApi, query: string): Promise<{ agent_name: string; agent_role_prompt: string }> {
  const text = await completeText(api, [
    {
      role: "user",
      content: {
        type: "text",
        text: `Choose a research agent role for this task. Return JSON with keys "server" and "agent_role_prompt" only.\n\nTask: ${query}`,
      },
    },
  ]);
  const parsed = parseJsonObject(text);
  return {
    agent_name: String(parsed?.server || "Default Research Assistant"),
    agent_role_prompt: String(
      parsed?.agent_role_prompt || "You are an objective research assistant who writes structured, source-grounded reports.",
    ),
  };
}

async function decideNextAction(input: {
  api: ResearchApi;
  query: string;
  rolePrompt: string;
  iteration: number;
  maxIterations: number;
  enabledSources: ResearchSourceView[];
  history: IterationEntry[];
}): Promise<Decision> {
  const { api, query, rolePrompt, iteration, maxIterations, enabledSources, history } = input;
  const defaultSourceId = enabledSources[0]?.id || "";
  const sourcesBlock = enabledSources
    .map((source) => `- ${source.id} (${source.name})`)
    .join("\n");
  const historyBlock = history.length
    ? history
        .map((entry) => {
          const titles = entry.source_calls
            .flatMap((call) => call.top_titles)
            .filter(Boolean)
            .slice(0, 5)
            .join(" | ");
          return `- iteration ${entry.iteration} via ${entry.source_name}: queries=${JSON.stringify(entry.queries)} results=${entry.results_count} titles=${titles}`;
        })
        .join("\n")
    : "(no prior iterations)";
  const text = await completeText(api, [
    {
      role: "system",
      content: {
        type: "text",
        text:
          (rolePrompt || "You are an objective research assistant.") +
          "\n\nDecide the next research step. Reply with strict JSON only.\n" +
          'Return either {"type":"call_source","source_id":"<id>","queries":[...]} to gather more context, or {"type":"finish"} when you have enough to write the report.\n' +
          "Pick a source_id from the available list. Avoid repeating prior queries. Prefer finishing once you have enough breadth and depth.",
      },
    },
    {
      role: "user",
      content: {
        type: "text",
        text:
          `Task: ${query}\n` +
          `Available sources:\n${sourcesBlock}\n` +
          `Iteration: ${iteration}/${maxIterations}\n` +
          `Prior iterations:\n${historyBlock}\n\n` +
          'Return JSON: {"type":"call_source","source_id":"<id>","queries":["..."]} OR {"type":"finish"}.',
      },
    },
  ]);
  const parsed = parseJsonObject(text);
  const type = String(parsed?.type || "").trim();
  if (type === "call_source") {
    const queries = Array.isArray(parsed?.queries) ? (parsed!.queries as unknown[]) : [];
    const normalized = queries
      .map((entry) => String(entry || "").trim())
      .filter((entry): entry is string => Boolean(entry));
    const requestedId = String(parsed?.source_id || "").trim();
    const sourceId = enabledSources.some((s) => s.id === requestedId) ? requestedId : defaultSourceId;
    if (iteration === 1 && normalized.length === 0) {
      return { type: "call_source", source_id: sourceId, queries: [query] };
    }
    return { type: "call_source", source_id: sourceId, queries: normalized };
  }
  if (type === "finish") return { type: "finish" };
  if (iteration === 1) return { type: "call_source", source_id: defaultSourceId, queries: [query] };
  return { type: "finish" };
}

async function writeReport(api: ResearchApi, query: string, rolePrompt: string, selectedContext: string): Promise<string> {
  const text = await completeText(api, [
    {
      role: "system",
      content: {
        type: "text",
        text:
          (rolePrompt || "You are an objective research assistant.") +
          "\n\nContext items below carry a [来源: <name>] prefix; you may optionally attribute facts to specific sources but are not required to label every paragraph.",
      },
    },
    {
      role: "user",
      content: {
        type: "text",
        text: `Write a concise markdown research_report for: ${query}\n\nUse only the provided context. Include clear headings and cite sources by URL when useful.\n\nContext:\n${selectedContext}`,
      },
    },
  ]);
  const report = text.trim();
  if (!report) throw new Error("Anna LLM returned an empty report.");
  return report;
}

async function completeText(api: ResearchApi, messages: Parameters<ResearchApi["complete"]>[0]["messages"]): Promise<string> {
  const response = await api.complete({ messages });
  const content = response.content;
  return typeof content === "string" ? content : content?.text || "";
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const data = JSON.parse(text);
    return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
  } catch {
    const match = /\{[\s\S]*\}/.exec(text || "");
    if (!match) return null;
    try {
      const data = JSON.parse(match[0]);
      return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
}

export type UseResearchJobReturn = ReturnType<typeof useResearchJob>;
