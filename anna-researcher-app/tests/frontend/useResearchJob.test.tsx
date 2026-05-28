import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MAX_RESEARCH_ITERATIONS, useResearchJob } from "../../src/hooks/useResearchJob";
import type { ResearchApi } from "../../src/api/researchApi";
import type { ResearchSourceView, SourceCallResult } from "../../src/types";

type LlmReply = string;

interface ApiOptions {
  configured?: boolean;
  llmReplies?: LlmReply[];
  callOverrides?: Array<Partial<SourceCallResult>>;
  sources?: ResearchSourceView[];
}

function makeApi(options: ApiOptions = {}) {
  const calls: unknown[] = [];
  const llmCalls: Array<{ messages: unknown }> = [];
  const configured = options.configured ?? true;
  const tavilySource: ResearchSourceView = {
    id: "tavily",
    name: "Tavily",
    kind: "builtin",
    enabled: true,
    max_parallel: 3,
    credential_status: configured ? "configured" : "missing",
    credential: configured ? "tvly-test" : "",
  };
  const sourcesList = options.sources ?? [tavilySource];
  const replies = options.llmReplies ?? [];
  const callOverrides = options.callOverrides ?? [];
  let callIndex = 0;
  const api: ResearchApi = {
    async getSettings() {
      calls.push(["getSettings"]);
      return { tavily: { configured, masked: configured ? "***test" : "" } };
    },
    async updateSettings(input) {
      calls.push(["updateSettings", input]);
      return { tavily: { configured: !input.clear_tavily_api_key, masked: input.clear_tavily_api_key ? "" : "***test" } };
    },
    async listResearchSources() {
      calls.push(["listResearchSources"]);
      return sourcesList;
    },
    async updateResearchSourceCredential(input) {
      calls.push(["updateResearchSourceCredential", input]);
      return sourcesList.find((s) => s.id === input.id) ?? tavilySource;
    },
    async setResearchSourceEnabled(input) {
      calls.push(["setResearchSourceEnabled", input]);
      const source = sourcesList.find((s) => s.id === input.id) ?? tavilySource;
      return { ...source, enabled: input.enabled };
    },
    async upsertResearchSource(input) {
      calls.push(["upsertResearchSource", input]);
      const def = input.definition as { id?: string; name?: string };
      return {
        id: String(def.id || "user-source"),
        name: String(def.name || def.id || "User Source"),
        kind: "user",
        enabled: true,
        max_parallel: 1,
        credential_status: input.credential ? "configured" : "missing",
        credential: input.credential || "",
      };
    },
    async deleteResearchSource(input) {
      calls.push(["deleteResearchSource", input]);
      return { id: input.id, deleted: true };
    },
    async testResearchSource(input) {
      calls.push(["testResearchSource", input]);
      return {
        source_id: input.id,
        source_name: input.id,
        query: input.query,
        duration_ms: 1,
        pages: [],
        extracted: [],
        error: null,
      };
    },
    async getResearchJob() {
      calls.push(["getResearchJob"]);
      return null;
    },
    async createResearchJob(input) {
      calls.push(["createResearchJob", input]);
      return { research_id: "r1", status: "created", stage: "select_role", progress: 0, query: input.query };
    },
    async updateResearchJob(researchId, updates) {
      calls.push(["updateResearchJob", researchId, updates]);
      return { research_id: researchId, status: "running", ...(updates as object) };
    },
    async callResearchSource(input) {
      calls.push(["callResearchSource", input]);
      const override = callOverrides[callIndex] ?? {};
      callIndex++;
      return {
        job: {
          research_id: input.research_id,
          status: "running",
          stage: "search_next_query",
          progress: 50 + input.iteration * 5,
          iteration: input.iteration,
          iterations: [],
        },
        source_call: {
          source_id: input.source_id,
          source_name: "Tavily",
          queries: input.queries,
          results_count: override.results_count ?? input.queries.length,
          top_titles: override.top_titles ?? input.queries.map((q) => `Title for ${q}`),
          duration_ms: 5,
          error: override.error ?? null,
          calls: override.calls ?? input.queries.map((q) => ({
            source_id: input.source_id,
            source_name: "Tavily",
            query: q,
            results_count: 1,
            top_titles: [`Title for ${q}`],
            duration_ms: 5,
            error: null,
          })),
        },
      };
    },
    async selectContext(input) {
      calls.push(["selectContext", input]);
      return {
        job: { research_id: input.research_id, status: "running", stage: "select_context", progress: 88 },
        selected_context: "FULL CONTEXT",
        selected_sources: [],
        source_urls: ["https://example.com"],
      };
    },
    async saveResearchResult(input) {
      calls.push(["saveResearchResult", input]);
      return { method: "POST", url: "http://127.0.0.1:43123/research-results/" + input.research_id, content_type: "application/json" };
    },
    async uploadResearchResult(transfer, input) {
      calls.push(["uploadResearchResult", transfer, input]);
      return {
        job: {
          research_id: "r1",
          status: "completed",
          stage: "completed",
          progress: 100,
          result: { report_markdown: input.report_markdown, source_urls: input.source_urls },
        },
        result: { report_markdown: input.report_markdown, source_urls: input.source_urls },
      };
    },
    async complete(request) {
      llmCalls.push(request as { messages: unknown });
      expect(request).not.toHaveProperty("maxTokens");
      const index = llmCalls.length - 1;
      const reply = replies[index] ?? "";
      return { content: { type: "text", text: reply } };
    },
  };
  return { api, calls, llmCalls };
}

const ROLE_REPLY = '{"server":"Researcher","agent_role_prompt":"Use sources."}';
const FINISH_REPLY = '{"type":"finish"}';
const REPORT_REPLY = "# Done\n\nUses FULL CONTEXT";

describe("useResearchJob (iterative loop)", () => {
  it("gates research when no research source credential is configured", async () => {
    const { api, calls } = makeApi({ configured: false });
    const { result } = renderHook(() => useResearchJob(api));

    await waitFor(() => expect(result.current.phase).toBe("settings_required"));
    await act(async () => {
      await result.current.start("anna");
    });

    expect(calls.some((call) => Array.isArray(call) && call[0] === "createResearchJob")).toBe(false);
  });

  it("runs a single iteration then finishes when the decision says finish", async () => {
    const { api, calls, llmCalls } = makeApi({
      llmReplies: [
        ROLE_REPLY,
        '{"type":"call_source","queries":["anna query","second query"]}',
        FINISH_REPLY,
        REPORT_REPLY,
      ],
    });
    const { result } = renderHook(() => useResearchJob(api));

    await waitFor(() => expect(result.current.phase).toBe("idle"));
    await act(async () => {
      await result.current.start("anna");
    });

    expect(result.current.phase).toBe("completed");
    expect(result.current.result?.report_markdown).toContain("# Done");
    expect(llmCalls).toHaveLength(4);

    const callSourceCalls = calls.filter((call) => Array.isArray(call) && call[0] === "callResearchSource");
    expect(callSourceCalls).toHaveLength(1);
    expect(callSourceCalls[0]).toEqual([
      "callResearchSource",
      { research_id: "r1", iteration: 1, source_id: "tavily", queries: ["anna query", "second query"] },
    ]);

    const decisionMessages = JSON.stringify(llmCalls[1]);
    expect(decisionMessages).toContain("call_source");
    expect(decisionMessages).toContain("finish");
    expect(decisionMessages).toContain("Iteration: 1/5");
    expect(JSON.stringify(calls)).not.toContain("query_domains");
    expect(JSON.stringify(calls.find((call) => Array.isArray(call) && call[0] === "saveResearchResult"))).not.toContain(
      "report_markdown",
    );
  });

  it("iterates multiple times when the LLM keeps requesting more searches, capped at MAX_RESEARCH_ITERATIONS", async () => {
    const replies = [ROLE_REPLY];
    for (let i = 1; i <= MAX_RESEARCH_ITERATIONS; i++) {
      replies.push(JSON.stringify({ type: "call_source", queries: [`q${i}`] }));
    }
    replies.push(REPORT_REPLY);
    const { api, calls } = makeApi({ llmReplies: replies });
    const { result } = renderHook(() => useResearchJob(api));

    await waitFor(() => expect(result.current.phase).toBe("idle"));
    await act(async () => {
      await result.current.start("anna");
    });

    expect(result.current.phase).toBe("completed");
    const callSourceCalls = calls.filter((call) => Array.isArray(call) && call[0] === "callResearchSource");
    expect(callSourceCalls).toHaveLength(MAX_RESEARCH_ITERATIONS);
    expect((callSourceCalls[0] as unknown[])[1]).toMatchObject({ iteration: 1, queries: ["q1"] });
    expect((callSourceCalls[MAX_RESEARCH_ITERATIONS - 1] as unknown[])[1]).toMatchObject({
      iteration: MAX_RESEARCH_ITERATIONS,
    });
  });

  it("skips duplicate queries and finishes when the LLM keeps repeating them", async () => {
    const { api, calls, llmCalls } = makeApi({
      llmReplies: [
        ROLE_REPLY,
        '{"type":"call_source","queries":["anna query"]}',
        '{"type":"call_source","queries":["Anna Query","anna query"]}',
        REPORT_REPLY,
      ],
    });
    const { result } = renderHook(() => useResearchJob(api));

    await waitFor(() => expect(result.current.phase).toBe("idle"));
    await act(async () => {
      await result.current.start("anna");
    });

    expect(result.current.phase).toBe("completed");
    const callSourceCalls = calls.filter((call) => Array.isArray(call) && call[0] === "callResearchSource");
    expect(callSourceCalls).toHaveLength(1);
    expect(llmCalls).toHaveLength(4);
  });

  it("calls a non-default source when the decision picks one from the enabled set", async () => {
    const tavily: ResearchSourceView = {
      id: "tavily",
      name: "Tavily",
      kind: "builtin",
      enabled: true,
      max_parallel: 3,
      credential_status: "configured",
      credential: "token-tav",
    };
    const custom: ResearchSourceView = {
      id: "custom",
      name: "Custom",
      kind: "user",
      enabled: true,
      max_parallel: 1,
      credential_status: "configured",
      credential: "token-cus",
    };
    const { api, calls, llmCalls } = makeApi({
      sources: [tavily, custom],
      llmReplies: [
        ROLE_REPLY,
        '{"type":"call_source","source_id":"custom","queries":["focused query"]}',
        FINISH_REPLY,
        REPORT_REPLY,
      ],
    });
    const { result } = renderHook(() => useResearchJob(api));

    await waitFor(() => expect(result.current.phase).toBe("idle"));
    await act(async () => {
      await result.current.start("anna");
    });

    expect(result.current.phase).toBe("completed");
    const callSourceCalls = calls.filter((call) => Array.isArray(call) && call[0] === "callResearchSource");
    expect(callSourceCalls).toHaveLength(1);
    expect((callSourceCalls[0] as unknown[])[1]).toMatchObject({ source_id: "custom", queries: ["focused query"] });
    const sourcesList = JSON.stringify(llmCalls[1]);
    expect(sourcesList).toContain("tavily");
    expect(sourcesList).toContain("custom");
  });

  it("ignores an unknown source_id and falls back to the first enabled source", async () => {
    const tavily: ResearchSourceView = {
      id: "tavily",
      name: "Tavily",
      kind: "builtin",
      enabled: true,
      max_parallel: 3,
      credential_status: "configured",
      credential: "token-tav",
    };
    const { api, calls } = makeApi({
      sources: [tavily],
      llmReplies: [
        ROLE_REPLY,
        '{"type":"call_source","source_id":"unknown","queries":["anna fallback"]}',
        FINISH_REPLY,
        REPORT_REPLY,
      ],
    });
    const { result } = renderHook(() => useResearchJob(api));

    await waitFor(() => expect(result.current.phase).toBe("idle"));
    await act(async () => {
      await result.current.start("anna");
    });

    const callSourceCalls = calls.filter((call) => Array.isArray(call) && call[0] === "callResearchSource");
    expect((callSourceCalls[0] as unknown[])[1]).toMatchObject({ source_id: "tavily" });
  });

  it("exposes CRUD operations on research sources", async () => {
    const { api, calls } = makeApi();
    const { result } = renderHook(() => useResearchJob(api));
    await waitFor(() => expect(result.current.phase).toBe("idle"));

    await act(async () => {
      await result.current.setSourceEnabled({ id: "tavily", enabled: false });
      await result.current.upsertSource({
        definition: { id: "custom", name: "Custom" },
        credential: "secret-token",
      });
      await result.current.deleteSource({ id: "custom" });
    });

    expect(calls.find((call) => Array.isArray(call) && call[0] === "setResearchSourceEnabled")).toEqual([
      "setResearchSourceEnabled",
      { id: "tavily", enabled: false },
    ]);
    expect(calls.find((call) => Array.isArray(call) && call[0] === "upsertResearchSource")).toEqual([
      "upsertResearchSource",
      { definition: { id: "custom", name: "Custom" }, credential: "secret-token" },
    ]);
    expect(calls.find((call) => Array.isArray(call) && call[0] === "deleteResearchSource")).toEqual([
      "deleteResearchSource",
      { id: "custom" },
    ]);
  });

  it("falls back to using the raw query when the first decision returns invalid JSON", async () => {
    const { api, calls } = makeApi({
      llmReplies: [ROLE_REPLY, "not json", FINISH_REPLY, REPORT_REPLY],
    });
    const { result } = renderHook(() => useResearchJob(api));

    await waitFor(() => expect(result.current.phase).toBe("idle"));
    await act(async () => {
      await result.current.start("anna");
    });

    const callSourceCalls = calls.filter((call) => Array.isArray(call) && call[0] === "callResearchSource");
    expect(callSourceCalls).toHaveLength(1);
    expect((callSourceCalls[0] as unknown[])[1]).toMatchObject({
      research_id: "r1",
      iteration: 1,
      source_id: "tavily",
      queries: ["anna"],
    });
  });
});
