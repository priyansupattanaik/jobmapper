import { Source, SourceType } from "../types";

export interface RawDiscoveredJob {
  sourceJobId: string;
  sourceUrl: string;
  applicationUrl: string;
  title: string;
  companyName: string;
  companyWebsite?: string;
  description: string;
  locationText: string;
  employmentType?: string;
  workMode?: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  salaryPeriod?: "yearly" | "monthly" | "hourly" | null;
  skills?: string[];
  postedAt?: string | null;
  rawPayload: Record<string, any> | string;
}

export interface ConnectorFetchResult {
  jobs: RawDiscoveredJob[];
  httpStatus: number;
  rateLimitStatus?: Record<string, any>;
  errors?: string[];
}

export abstract class BaseSourceConnector {
  abstract id: string;
  abstract name: string;
  abstract sourceType: SourceType;
  abstract sourceUrl: string;
  abstract retrievalMethod: "api" | "rss_feed" | "crawler";
  abstract reliabilityScore: number;

  abstract fetchJobs(): Promise<ConnectorFetchResult>;

  toSourceEntity(): Source {
    return {
      id: this.id,
      name: this.name,
      source_type: this.sourceType,
      source_url: this.sourceUrl,
      retrieval_method: this.retrievalMethod,
      last_successful_retrieval: null,
      last_attempted_retrieval: null,
      http_status: null,
      parsing_status: "idle",
      jobs_discovered: 0,
      jobs_accepted: 0,
      jobs_rejected: 0,
      jobs_duplicated: 0,
      error_logs: [],
      rate_limit_status: {},
      data_freshness: null,
      reliability_score: this.reliabilityScore,
      is_active: true
    };
  }
}
