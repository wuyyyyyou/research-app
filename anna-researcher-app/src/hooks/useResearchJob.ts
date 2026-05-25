import { useCallback, useRef, useState } from "react";
import type { ResearchApi } from "../api/researchApi";
import type { ResearchJob, ResearchPhase, ResearchResult } from "../types";

const terminalStatuses = new Set(["completed", "failed", "cancelled"]);

export function useResearchJob(api: ResearchApi) {
  const [job, setJob] = useState<ResearchJob | null>(null);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [phase, setPhase] = useState<ResearchPhase>("idle");
  const [error, setError] = useState<unknown>(null);
  const pollingRef = useRef(false);

  const loadResult = useCallback(
    async (researchId: string) => {
      setPhase("loading_result");
      const nextResult = await api.getResult(researchId);
      setResult(nextResult);
      setPhase("completed");
      return nextResult;
    },
    [api],
  );

  const advanceOnce = useCallback(
    async (inputJob?: ResearchJob | null) => {
      const activeJob = inputJob ?? job;
      if (!activeJob?.research_id) return null;
      setPhase("running");
      const nextJob = await api.advance(activeJob.research_id);
      setJob(nextJob);
      if (nextJob.status === "completed" && nextJob.research_id) {
        await loadResult(nextJob.research_id);
      } else if (nextJob.status === "failed") {
        setPhase("failed");
      }
      return nextJob;
    },
    [api, job, loadResult],
  );

  const runPollingLoop = useCallback(
    async (initialJob: ResearchJob) => {
      if (pollingRef.current) return;
      pollingRef.current = true;
      try {
        let current: ResearchJob | null = initialJob;
        while (current?.research_id && !terminalStatuses.has(current.status || "")) {
          current = await advanceOnce(current);
          if (current?.status && !terminalStatuses.has(current.status)) {
            await wait(900);
          }
        }
      } catch (err) {
        setError(err);
        setPhase("failed");
      } finally {
        pollingRef.current = false;
      }
    },
    [advanceOnce],
  );

  const start = useCallback(
    async (query: string, queryDomains: string[]) => {
      setPhase("starting");
      setError(null);
      setResult(null);
      try {
        const nextJob = await api.start({ query, query_domains: queryDomains });
        setJob(nextJob);
        setPhase("running");
        void runPollingLoop(nextJob);
      } catch (err) {
        setError(err);
        setPhase("failed");
      }
    },
    [api, runPollingLoop],
  );

  return {
    job,
    result,
    phase,
    error,
    isBusy: phase === "starting" || phase === "running" || phase === "loading_result",
    canAdvance: Boolean(job?.research_id) && !terminalStatuses.has(job?.status || "") && !pollingRef.current,
    start,
    advanceOnce: () => advanceOnce(),
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
