import { describe, expect, it } from "vitest";
import { AnnaResearchApi } from "../../src/api/researchApi";
import { TOOL_ID, type AnnaRuntimeApi } from "../../src/types";

describe("AnnaResearchApi", () => {
  it("uses explicit app tool methods including app_call_research_source", async () => {
    const calls: unknown[] = [];
    const anna: AnnaRuntimeApi = {
      tools: {
        async invoke(request) {
          calls.push(request);
          if (request.method === "app_get_settings" || request.method === "app_update_settings") {
            return { success: true, data: { settings: { tavily: { configured: true, masked: "***test" } } } };
          }
          if (request.method === "app_list_research_sources") {
            return {
              success: true,
              data: {
                sources: [
                  {
                    id: "tavily",
                    name: "Tavily",
                    kind: "builtin",
                    enabled: true,
                    max_parallel: 3,
                    credential_status: "configured",
                    credential_masked: "***test",
                  },
                ],
              },
            };
          }
          if (request.method === "app_update_research_source_credential") {
            return {
              success: true,
              data: {
                source: {
                  id: "tavily",
                  name: "Tavily",
                  kind: "builtin",
                  enabled: true,
                  max_parallel: 3,
                  credential_status: "configured",
                  credential_masked: "***test",
                },
              },
            };
          }
          if (request.method === "app_get_research_job") {
            return { success: true, data: { job: null } };
          }
          if (request.method === "app_call_research_source") {
            return {
              success: true,
              data: {
                job: { research_id: "r1" },
                source_call: {
                  source_id: "tavily",
                  source_name: "Tavily",
                  queries: ["anna"],
                  results_count: 1,
                  top_titles: ["x"],
                  duration_ms: 4,
                  error: null,
                  calls: [],
                },
              },
            };
          }
          if (request.method === "app_select_context") {
            return { success: true, data: { selected_context: "context", selected_sources: [], source_urls: [] } };
          }
          if (request.method === "app_save_research_result") {
            return {
              success: true,
              data: { transfer: { method: "POST", url: "http://127.0.0.1:43123/research-results/r1", content_type: "application/json" } },
            };
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
      return new Response(
        JSON.stringify({ result: { report_markdown: "# Report", source_urls: ["https://example.com"] } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;
    try {
      await api.getSettings();
      await api.updateSettings({ tavily_api_key: "tvly-test" });
      await api.listResearchSources();
      await api.updateResearchSourceCredential({ id: "tavily", credential: "tvly-test" });
      await api.createResearchJob({ query: "anna" });
      await api.updateResearchJob("r1", { stage: "plan_queries" });
      await api.getResearchJob("r1");
      await api.callResearchSource({ research_id: "r1", iteration: 1, source_id: "tavily", queries: ["anna"] });
      await api.selectContext({ research_id: "r1" });
      const transfer = await api.saveResearchResult({ research_id: "r1" });
      await api.uploadResearchResult(transfer, { report_markdown: "# Report", source_urls: ["https://example.com"] });

      expect(calls).toEqual([
        { tool_id: TOOL_ID, method: "app_get_settings", args: {} },
        { tool_id: TOOL_ID, method: "app_update_settings", args: { tavily_api_key: "tvly-test" } },
        { tool_id: TOOL_ID, method: "app_list_research_sources", args: {} },
        { tool_id: TOOL_ID, method: "app_update_research_source_credential", args: { id: "tavily", credential: "tvly-test" } },
        { tool_id: TOOL_ID, method: "app_create_research_job", args: { query: "anna" } },
        { tool_id: TOOL_ID, method: "app_update_research_job", args: { research_id: "r1", updates: { stage: "plan_queries" } } },
        { tool_id: TOOL_ID, method: "app_get_research_job", args: { research_id: "r1" } },
        {
          tool_id: TOOL_ID,
          method: "app_call_research_source",
          args: { research_id: "r1", iteration: 1, source_id: "tavily", queries: ["anna"] },
        },
        { tool_id: TOOL_ID, method: "app_select_context", args: { research_id: "r1" } },
        { tool_id: TOOL_ID, method: "app_save_research_result", args: { research_id: "r1" } },
      ]);
      expect(fetchCalls).toHaveLength(1);
      expect(JSON.stringify(fetchCalls[0])).toContain("# Report");
    } finally {
      globalThis.fetch = oldFetch;
    }
  });
});
