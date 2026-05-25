export const TOOL_ID = "tool-test-researcher-12345678";
export const TOOL_METHOD = "research";

export type ResearchAction = "start" | "advance" | "get_status" | "get_result";

export type ResearchStatus = "created" | "running" | "completed" | "failed" | "cancelled" | string;

export type ResearchStage =
  | "idle"
  | "select_role"
  | "plan_queries"
  | "search_next_query"
  | "select_context"
  | "write_report"
  | "completed"
  | "failed"
  | string;

export interface ResearchError {
  code?: string;
  message?: string;
  details?: unknown;
}

export interface ResearchJob {
  research_id?: string;
  status?: ResearchStatus;
  stage?: ResearchStage;
  progress?: number;
  source_count?: number;
  search_index?: number;
  search_total?: number;
  error?: ResearchError | null;
}

export interface ResearchResult {
  report_type?: string;
  report_markdown?: string;
  source_urls?: string[];
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface StartResearchInput {
  query: string;
  query_domains: string[];
}

export interface AnnaToolInvokeRequest {
  tool_id: string;
  method: string;
  args: Record<string, unknown>;
}

export interface AnnaToolsApi {
  invoke(request: AnnaToolInvokeRequest): Promise<unknown>;
}

export interface AnnaRuntimeApi {
  tools: AnnaToolsApi;
}

export interface AnnaRuntimeGlobal {
  connect(): Promise<AnnaRuntimeApi>;
}

export type ConnectionState = "connected" | "standalone";

export type ResearchPhase = "idle" | "starting" | "running" | "loading_result" | "completed" | "failed";
