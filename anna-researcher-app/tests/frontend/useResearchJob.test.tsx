import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useResearchJob } from "../../src/hooks/useResearchJob";
import type { ResearchApi } from "../../src/api/researchApi";

describe("useResearchJob", () => {
  it("starts, advances, and loads completed result", async () => {
    vi.useFakeTimers();
    const api: ResearchApi = {
      async start() {
        return { research_id: "r1", status: "running", stage: "select_role", progress: 10 };
      },
      async advance() {
        return { research_id: "r1", status: "completed", stage: "completed", progress: 100 };
      },
      async getStatus() {
        return { research_id: "r1", status: "completed" };
      },
      async getResult() {
        return { report_markdown: "# Done", source_urls: ["https://example.com"] };
      },
    };

    const { result } = renderHook(() => useResearchJob(api));

    await act(async () => {
      await result.current.start("anna", []);
      await vi.runOnlyPendingTimersAsync();
    });

    expect(result.current.job?.status).toBe("completed");
    expect(result.current.result?.report_markdown).toBe("# Done");
    expect(result.current.phase).toBe("completed");
    vi.useRealTimers();
  });
});
