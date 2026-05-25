import { TOOL_ID, TOOL_METHOD, type AnnaRuntimeApi, type ResearchAction, type ResearchJob, type ResearchResult, type StartResearchInput } from "../types";

interface JobResponse {
  job?: ResearchJob;
}

interface ResultResponse {
  result?: ResearchResult;
}

export interface ResearchApi {
  start(input: StartResearchInput): Promise<ResearchJob>;
  advance(researchId: string): Promise<ResearchJob>;
  getStatus(researchId: string): Promise<ResearchJob>;
  getResult(researchId: string): Promise<ResearchResult>;
}

export class AnnaResearchApi implements ResearchApi {
  constructor(private readonly anna: AnnaRuntimeApi) {}

  async start(input: StartResearchInput): Promise<ResearchJob> {
    return requireJob(await this.call("start", { query: input.query, query_domains: input.query_domains }));
  }

  async advance(researchId: string): Promise<ResearchJob> {
    return requireJob(await this.call("advance", { research_id: researchId }));
  }

  async getStatus(researchId: string): Promise<ResearchJob> {
    return requireJob(await this.call("get_status", { research_id: researchId }));
  }

  async getResult(researchId: string): Promise<ResearchResult> {
    const response = (await this.call("get_result", { research_id: researchId })) as ResultResponse;
    if (!response.result) {
      throw new Error("Research result response did not include a result.");
    }
    return response.result;
  }

  private async call(action: ResearchAction, extra: Record<string, unknown>): Promise<unknown> {
    return await this.anna.tools.invoke({
      tool_id: TOOL_ID,
      method: TOOL_METHOD,
      args: { action, ...extra },
    });
  }
}

export function createStandaloneApi(): ResearchApi {
  return {
    async start(): Promise<ResearchJob> {
      throw new Error("Anna runtime is not connected.");
    },
    async advance(): Promise<ResearchJob> {
      throw new Error("Anna runtime is not connected.");
    },
    async getStatus(): Promise<ResearchJob> {
      throw new Error("Anna runtime is not connected.");
    },
    async getResult(): Promise<ResearchResult> {
      throw new Error("Anna runtime is not connected.");
    },
  };
}

function requireJob(response: unknown): ResearchJob {
  const job = (response as JobResponse)?.job;
  if (!job) {
    throw new Error("Research response did not include a job.");
  }
  return job;
}
