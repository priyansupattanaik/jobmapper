import { BaseSourceConnector, ConnectorFetchResult, RawDiscoveredJob } from "./base";
import { SourceType } from "../types";

export class RemotiveConnector extends BaseSourceConnector {
  id = "remotive-api";
  name = "Remotive Verified Remote Feed";
  sourceType: SourceType = "established_job_board";
  sourceUrl = "https://remotive.com";
  retrievalMethod = "api" as const;
  reliabilityScore = 0.90;

  async fetchJobs(): Promise<ConnectorFetchResult> {
    const url = "https://remotive.com/api/remote-jobs?limit=40";
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(url, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "JobMapper/1.0 (+https://jobmapper.local)"
        },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!res.ok) {
        return { jobs: [], httpStatus: res.status, errors: [`HTTP error ${res.status}`] };
      }

      const data = await res.json();
      const rawList = Array.isArray(data.jobs) ? data.jobs : [];
      const jobs: RawDiscoveredJob[] = [];

      for (const item of rawList) {
        if (!item.title || !item.company_name) continue;

        jobs.push({
          sourceJobId: `remotive_${item.id}`,
          sourceUrl: item.url,
          applicationUrl: item.url,
          title: item.title,
          companyName: item.company_name,
          description: item.description ? item.description.replace(/<[^>]+>/g, " ").slice(0, 3000) : item.title,
          locationText: item.candidate_required_location || "Worldwide Remote",
          workMode: "remote",
          employmentType: item.job_type ? item.job_type.toLowerCase().replace("-", "_") : "full_time",
          skills: item.tags || [],
          postedAt: item.publication_date ? new Date(item.publication_date).toISOString() : null,
          rawPayload: item
        });
      }

      return {
        jobs,
        httpStatus: res.status
      };
    } catch (err) {
      return {
        jobs: [],
        httpStatus: 500,
        errors: [(err as Error).message]
      };
    }
  }
}
