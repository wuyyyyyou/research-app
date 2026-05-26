import { TOOL_ID, type AnnaRuntimeApi, type ResearchJob, type ResearchResult, type ResultTransferDescriptor, type SearchResult, type StartResearchInput, type ToolSettings } from "../types";

interface SettingsResponse {
  settings?: ToolSettings;
}

interface JobResponse {
  job?: ResearchJob | null;
}

interface SearchResponse extends JobResponse {
  search_queries?: string[];
  search_results?: SearchResult[];
  source_urls?: string[];
}

interface ContextResponse extends JobResponse {
  selected_context?: string;
  selected_sources?: SearchResult[];
  source_urls?: string[];
}

interface ResultResponse extends JobResponse {
  result?: ResearchResult;
}

interface TransferResponse {
  transfer?: ResultTransferDescriptor;
}

export interface ResearchApi {
  getSettings(): Promise<ToolSettings>;
  updateSettings(input: { tavily_api_key?: string; clear_tavily_api_key?: boolean }): Promise<ToolSettings>;
  createResearchJob(input: StartResearchInput): Promise<ResearchJob>;
  updateResearchJob(researchId: string, updates: Record<string, unknown>): Promise<ResearchJob>;
  getResearchJob(researchId?: string): Promise<ResearchJob | null>;
  searchWeb(input: { research_id: string; search_queries: string[]; query_domains?: string[] }): Promise<SearchResponse>;
  selectContext(input: { research_id: string }): Promise<ContextResponse>;
  saveResearchResult(input: { research_id: string }): Promise<ResultTransferDescriptor>;
  uploadResearchResult(transfer: ResultTransferDescriptor, input: { report_markdown: string; source_urls?: string[] }): Promise<ResultResponse>;
  complete(messages: AnnaRuntimeApi["llm"]["complete"] extends (request: infer Req) => unknown ? Req : never): ReturnType<AnnaRuntimeApi["llm"]["complete"]>;
}

export class AnnaResearchApi implements ResearchApi {
  constructor(private readonly anna: AnnaRuntimeApi) {}

  async getSettings(): Promise<ToolSettings> {
    const response = (await this.call("app_get_settings", {})) as SettingsResponse;
    if (!response.settings) throw new Error("Settings response did not include settings.");
    return response.settings;
  }

  async updateSettings(input: { tavily_api_key?: string; clear_tavily_api_key?: boolean }): Promise<ToolSettings> {
    const response = (await this.call("app_update_settings", input)) as SettingsResponse;
    if (!response.settings) throw new Error("Settings response did not include settings.");
    return response.settings;
  }

  async createResearchJob(input: StartResearchInput): Promise<ResearchJob> {
    return requireJob(await this.call("app_create_research_job", { query: input.query, query_domains: input.query_domains }));
  }

  async updateResearchJob(researchId: string, updates: Record<string, unknown>): Promise<ResearchJob> {
    return requireJob(await this.call("app_update_research_job", { research_id: researchId, updates }));
  }

  async getResearchJob(researchId?: string): Promise<ResearchJob | null> {
    const response = (await this.call("app_get_research_job", researchId ? { research_id: researchId } : {})) as JobResponse;
    return response.job ?? null;
  }

  async searchWeb(input: { research_id: string; search_queries: string[]; query_domains?: string[] }): Promise<SearchResponse> {
    return (await this.call("app_search_web", input)) as SearchResponse;
  }

  async selectContext(input: { research_id: string }): Promise<ContextResponse> {
    return (await this.call("app_select_context", input)) as ContextResponse;
  }

  async saveResearchResult(input: { research_id: string }): Promise<ResultTransferDescriptor> {
    const response = (await this.call("app_save_research_result", input)) as TransferResponse;
    if (!response.transfer?.url) throw new Error("Save response did not include a result transfer URL.");
    return response.transfer;
  }

  async uploadResearchResult(transfer: ResultTransferDescriptor, input: { report_markdown: string; source_urls?: string[] }): Promise<ResultResponse> {
    const response = await fetch(transfer.url, {
      method: transfer.method || "POST",
      headers: { "Content-Type": transfer.content_type || "application/json" },
      body: JSON.stringify(input),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = data?.message || data?.error || `Research result transfer failed with HTTP ${response.status}.`;
      throw new Error(message);
    }
    return data as ResultResponse;
  }

  complete(request: Parameters<AnnaRuntimeApi["llm"]["complete"]>[0]) {
    return this.anna.llm.complete(request);
  }

  private async call(method: string, args: Record<string, unknown>): Promise<unknown> {
    const response = await this.anna.tools.invoke({ tool_id: TOOL_ID, method, args });
    const maybe = response as { success?: boolean; data?: unknown; error?: string };
    if (maybe && maybe.success === false) {
      const error = new Error(maybe.error || "Research tool invocation failed.") as Error & { details?: unknown };
      error.details = maybe.data;
      throw error;
    }
    return maybe && "data" in maybe ? maybe.data : response;
  }
}

export function createStandaloneApi(): ResearchApi {
  const fail = async () => {
    throw new Error("Anna runtime is not connected.");
  };
  return {
    getSettings: fail,
    updateSettings: fail,
    createResearchJob: fail,
    updateResearchJob: fail,
    getResearchJob: fail,
    searchWeb: fail,
    selectContext: fail,
    saveResearchResult: fail,
    uploadResearchResult: fail,
    complete: fail as ResearchApi["complete"],
  };
}

function requireJob(response: unknown): ResearchJob {
  const job = (response as JobResponse)?.job;
  if (!job) throw new Error("Research response did not include a job.");
  return job;
}
