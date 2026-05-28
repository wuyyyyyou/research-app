import {
  TOOL_ID,
  type AnnaRuntimeApi,
  type IterationEntry,
  type ResearchJob,
  type ResearchResult,
  type ResearchSourceView,
  type ResultTransferDescriptor,
  type SearchResult,
  type SourceCallResult,
  type StartResearchInput,
  type ToolSettings,
} from "../types";

interface SettingsResponse {
  settings?: ToolSettings;
}

interface JobResponse {
  job?: ResearchJob | null;
}

interface SourceListResponse {
  sources?: ResearchSourceView[];
}

interface SourceResponse {
  source?: ResearchSourceView;
}

interface CallSourceResponse extends JobResponse {
  source_call?: SourceCallResult;
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
  listResearchSources(): Promise<ResearchSourceView[]>;
  updateResearchSourceCredential(input: { id: string; credential?: string; clear?: boolean }): Promise<ResearchSourceView>;
  setResearchSourceEnabled(input: { id: string; enabled: boolean }): Promise<ResearchSourceView>;
  upsertResearchSource(input: { definition: Record<string, unknown>; credential?: string }): Promise<ResearchSourceView>;
  deleteResearchSource(input: { id: string }): Promise<{ id: string; deleted: boolean }>;
  createResearchJob(input: StartResearchInput): Promise<ResearchJob>;
  updateResearchJob(researchId: string, updates: Record<string, unknown>): Promise<ResearchJob>;
  getResearchJob(researchId?: string): Promise<ResearchJob | null>;
  callResearchSource(input: {
    research_id: string;
    iteration: number;
    source_id: string;
    queries: string[];
  }): Promise<CallSourceResponse>;
  selectContext(input: {
    research_id: string;
    search_queries?: string[];
    search_results?: SearchResult[];
  }): Promise<ContextResponse>;
  saveResearchResult(input: { research_id: string }): Promise<ResultTransferDescriptor>;
  uploadResearchResult(
    transfer: ResultTransferDescriptor,
    input: { report_markdown: string; source_urls?: string[] },
  ): Promise<ResultResponse>;
  complete(messages: AnnaRuntimeApi["llm"]["complete"] extends (request: infer Req) => unknown ? Req : never): ReturnType<
    AnnaRuntimeApi["llm"]["complete"]
  >;
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

  async listResearchSources(): Promise<ResearchSourceView[]> {
    const response = (await this.call("app_list_research_sources", {})) as SourceListResponse;
    return response.sources ?? [];
  }

  async updateResearchSourceCredential(input: { id: string; credential?: string; clear?: boolean }): Promise<ResearchSourceView> {
    const response = (await this.call("app_update_research_source_credential", input)) as SourceResponse;
    if (!response.source) throw new Error("Source update did not return the source view.");
    return response.source;
  }

  async setResearchSourceEnabled(input: { id: string; enabled: boolean }): Promise<ResearchSourceView> {
    const response = (await this.call("app_set_research_source_enabled", input)) as SourceResponse;
    if (!response.source) throw new Error("Source enable did not return the source view.");
    return response.source;
  }

  async upsertResearchSource(input: { definition: Record<string, unknown>; credential?: string }): Promise<ResearchSourceView> {
    const response = (await this.call("app_upsert_research_source", input)) as SourceResponse;
    if (!response.source) throw new Error("Source upsert did not return the source view.");
    return response.source;
  }

  async deleteResearchSource(input: { id: string }): Promise<{ id: string; deleted: boolean }> {
    const response = (await this.call("app_delete_research_source", input)) as { id?: string; deleted?: boolean };
    return { id: response.id ?? input.id, deleted: Boolean(response.deleted) };
  }

  async createResearchJob(input: StartResearchInput): Promise<ResearchJob> {
    return requireJob(await this.call("app_create_research_job", { query: input.query }));
  }

  async updateResearchJob(researchId: string, updates: Record<string, unknown>): Promise<ResearchJob> {
    return requireJob(await this.call("app_update_research_job", { research_id: researchId, updates }));
  }

  async getResearchJob(researchId?: string): Promise<ResearchJob | null> {
    const response = (await this.call("app_get_research_job", researchId ? { research_id: researchId } : {})) as JobResponse;
    return response.job ?? null;
  }

  async callResearchSource(input: {
    research_id: string;
    iteration: number;
    source_id: string;
    queries: string[];
  }): Promise<CallSourceResponse> {
    return (await this.call("app_call_research_source", input)) as CallSourceResponse;
  }

  async selectContext(input: {
    research_id: string;
    search_queries?: string[];
    search_results?: SearchResult[];
  }): Promise<ContextResponse> {
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
    listResearchSources: fail,
    updateResearchSourceCredential: fail,
    setResearchSourceEnabled: fail,
    upsertResearchSource: fail,
    deleteResearchSource: fail,
    createResearchJob: fail,
    updateResearchJob: fail,
    getResearchJob: fail,
    callResearchSource: fail,
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

export type { IterationEntry };
