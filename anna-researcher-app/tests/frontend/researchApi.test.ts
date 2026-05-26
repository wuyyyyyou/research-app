import { describe, expect, it } from "vitest";
import { AnnaResearchApi } from "../../src/api/researchApi";
import { TOOL_ID, type AnnaRuntimeApi } from "../../src/types";

describe("AnnaResearchApi", () => {
  it("uses explicit app tool methods", async () => {
    const calls: unknown[] = [];
    const anna: AnnaRuntimeApi = {
      tools: {
        async invoke(request) {
          calls.push(request);
          if (request.method === "app_get_settings" || request.method === "app_update_settings") {
            return { success: true, data: { settings: { tavily: { configured: true, masked: "tvly...test" } } } };
          }
          if (request.method === "app_get_research_job") {
            return { success: true, data: { job: null } };
          }
          if (request.method === "app_search_web") {
            return { success: true, data: { job: { research_id: "r1" }, search_results: [] } };
          }
          if (request.method === "app_select_context") {
            return { success: true, data: { selected_context: "context", selected_sources: [], source_urls: [] } };
          }
          if (request.method === "app_save_research_result") {
            return { success: true, data: { transfer: { method: "POST", url: "http://127.0.0.1:43123/research-results/r1", content_type: "application/json" } } };
          }
          return { success: true, data: { job: { research_id: "r1", status: "running" } } };
        },
      },
      llm: {
        async complete() {
          return { content: { type: "text", text: "{}" } };
        },
      },
    };

    const api = new AnnaResearchApi(anna);
    const oldFetch = globalThis.fetch;
    const fetchCalls: unknown[] = [];
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls.push([url, init]);
      return new Response(JSON.stringify({ result: { report_markdown: "# Report", source_urls: ["https://example.com"] } }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;
    try {
    await api.getSettings();
    await api.updateSettings({ tavily_api_key: "tvly-test" });
    await api.createResearchJob({ query: "anna", query_domains: ["example.com"] });
    await api.updateResearchJob("r1", { stage: "plan_queries" });
    await api.getResearchJob("r1");
    await api.searchWeb({ research_id: "r1", search_queries: ["anna"] });
    await api.selectContext({ research_id: "r1" });
    const transfer = await api.saveResearchResult({ research_id: "r1" });
    await api.uploadResearchResult(transfer, { report_markdown: "# Report", source_urls: ["https://example.com"] });

    expect(calls).toEqual([
      { tool_id: TOOL_ID, method: "app_get_settings", args: {} },
      { tool_id: TOOL_ID, method: "app_update_settings", args: { tavily_api_key: "tvly-test" } },
      { tool_id: TOOL_ID, method: "app_create_research_job", args: { query: "anna", query_domains: ["example.com"] } },
      { tool_id: TOOL_ID, method: "app_update_research_job", args: { research_id: "r1", updates: { stage: "plan_queries" } } },
      { tool_id: TOOL_ID, method: "app_get_research_job", args: { research_id: "r1" } },
      { tool_id: TOOL_ID, method: "app_search_web", args: { research_id: "r1", search_queries: ["anna"] } },
      { tool_id: TOOL_ID, method: "app_select_context", args: { research_id: "r1" } },
      { tool_id: TOOL_ID, method: "app_save_research_result", args: { research_id: "r1" } },
    ]);
    expect(fetchCalls).toHaveLength(1);
    expect(JSON.stringify(fetchCalls[0])).toContain("# Report");
    expect(JSON.stringify(fetchCalls[0])).not.toContain("selected_sources");
    } finally {
      globalThis.fetch = oldFetch;
    }
  });
});
