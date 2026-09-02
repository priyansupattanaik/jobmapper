import { BaseSourceConnector, ConnectorFetchResult, RawDiscoveredJob } from "./base";
import { SourceType } from "../types";

export class ArbeitnowConnector extends BaseSourceConnector {
  id = "arbeitnow-api";
  name = "Arbeitnow Verified Feed";
  sourceType: SourceType = "established_job_board";
  sourceUrl = "https://www.arbeitnow.com";
  retrievalMethod = "api" as const;
  reliabilityScore = 0.90;

  async fetchJobs(): Promise<ConnectorFetchResult> {
    const url = "https://www.arbeitnow.com/api/job-board-api";
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
      const rawList = Array.isArray(data.data) ? data.data : [];
      const jobs: RawDiscoveredJob[] = [];

      for (const item of rawList.slice(0, 50)) {
        if (!item.title || !item.company_name) continue;

        const isRemote = Boolean(item.remote);
        const locationText = item.location || (isRemote ? "Remote" : "Unknown");

        jobs.push({
          sourceJobId: `arbeitnow_${item.slug}`,
          sourceUrl: item.url,
          applicationUrl: item.url,
          title: item.title,
          companyName: item.company_name,
          description: item.description ? item.description.replace(/<[^>]+>/g, " ").slice(0, 3000) : item.title,
          locationText,
          workMode: isRemote ? "remote" : "onsite",
          employmentType: item.job_types?.[0] ? item.job_types[0].toLowerCase().replace("-", "_") : "full_time",
          skills: item.tags || [],
          postedAt: item.created_at ? new Date(item.created_at * 1000).toISOString() : null,
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
