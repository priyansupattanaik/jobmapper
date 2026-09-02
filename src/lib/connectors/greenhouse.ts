import { BaseSourceConnector, ConnectorFetchResult, RawDiscoveredJob } from "./base";
import { SourceType } from "../types";

export class GreenhouseConnector extends BaseSourceConnector {
  id = "greenhouse-ats";
  name = "Greenhouse Verified ATS";
  sourceType: SourceType = "verified_ats";
  sourceUrl = "https://boards-api.greenhouse.io";
  retrievalMethod = "api" as const;
  reliabilityScore = 0.95;

  private boards: { token: string; companyName: string; website: string }[];

  constructor(boards?: { token: string; companyName: string; website: string }[]) {
    super();
    this.boards = boards || [
      { token: "cloudflare", companyName: "Cloudflare", website: "https://www.cloudflare.com" },
      { token: "gitlab", companyName: "GitLab", website: "https://about.gitlab.com" },
      { token: "automattic", companyName: "Automattic", website: "https://automattic.com" }
    ];
  }

  async fetchJobs(): Promise<ConnectorFetchResult> {
    const allJobs: RawDiscoveredJob[] = [];
    const errors: string[] = [];
    let lastHttpStatus = 200;

    for (const board of this.boards) {
      const url = `${this.sourceUrl}/v1/boards/${board.token}/jobs?content=true`;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(url, {
          headers: {
            "Accept": "application/json",
            "User-Agent": "JobMapper/1.0 (+https://jobmapper.local)"
          },
          signal: controller.signal
        });
        clearTimeout(timeout);

        lastHttpStatus = res.status;
        if (!res.ok) {
          errors.push(`Board ${board.token} returned status ${res.status}`);
          continue;
        }

        const data = await res.json();
        const rawJobs = data.jobs || [];

        for (const rj of rawJobs) {
          if (!rj.title) continue;

          const locationText = rj.location?.name || "Unknown";
          const isRemote = /remote/i.test(locationText);

          allJobs.push({
            sourceJobId: `gh_${board.token}_${rj.id}`,
            sourceUrl: rj.absolute_url || url,
            applicationUrl: rj.absolute_url || url,
            title: rj.title,
            companyName: board.companyName,
            companyWebsite: board.website,
            description: rj.content ? rj.content.replace(/<[^>]+>/g, " ").slice(0, 3000) : rj.title,
            locationText,
            workMode: isRemote ? "remote" : "onsite",
            employmentType: "full_time",
            postedAt: rj.updated_at ? new Date(rj.updated_at).toISOString() : null,
            rawPayload: rj
          });
        }
      } catch (err) {
        errors.push(`Error fetching board ${board.token}: ${(err as Error).message}`);
      }
    }

    return {
      jobs: allJobs,
      httpStatus: lastHttpStatus,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}
