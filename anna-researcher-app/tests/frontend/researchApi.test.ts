import { describe, expect, it } from "vitest";
import { AnnaResearchApi } from "../../src/api/researchApi";
import { TOOL_ID, TOOL_METHOD, type AnnaRuntimeApi } from "../../src/types";

describe("AnnaResearchApi", () => {
  it("uses stable tool action payloads", async () => {
    const calls: unknown[] = [];
    const anna: AnnaRuntimeApi = {
      tools: {
        async invoke(request) {
          calls.push(request);
          if (request.args.action === "get_result") {
            return { result: { report_markdown: "# Report", source_urls: [] } };
          }
          return { job: { research_id: "r1", status: "running" } };
        },
      },
    };

    const api = new AnnaResearchApi(anna);
    await api.start({ query: "anna", query_domains: ["example.com"] });
    await api.advance("r1");
    await api.getStatus("r1");
    await api.getResult("r1");

    expect(calls).toEqual([
      { tool_id: TOOL_ID, method: TOOL_METHOD, args: { action: "start", query: "anna", query_domains: ["example.com"] } },
      { tool_id: TOOL_ID, method: TOOL_METHOD, args: { action: "advance", research_id: "r1" } },
      { tool_id: TOOL_ID, method: TOOL_METHOD, args: { action: "get_status", research_id: "r1" } },
      { tool_id: TOOL_ID, method: TOOL_METHOD, args: { action: "get_result", research_id: "r1" } },
    ]);
  });
});
