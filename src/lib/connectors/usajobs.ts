import { BaseSourceConnector, ConnectorFetchResult, RawDiscoveredJob } from "./base";
import { SourceType } from "../types";

export class USAJobsGovConnector extends BaseSourceConnector {
  id = "usajobs-gov";
  name = "USAJobs Public Portal";
  sourceType: SourceType = "government_portal";
  sourceUrl = "https://www.usajobs.gov";
  retrievalMethod = "api" as const;
  reliabilityScore = 0.98;

  async fetchJobs(): Promise<ConnectorFetchResult> {
    const url = "https://data.usajobs.gov/api/search?ResultsPerPage=25";
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(url, {
        headers: {
          "User-Agent": "JobMapper/1.0 (contact@jobmapper.local)",
          "Accept": "application/json"
        },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!res.ok) {
        return { jobs: [], httpStatus: res.status, errors: [`USAJobs returned ${res.status}`] };
      }

      const data = await res.json();
      const items = data.SearchResult?.SearchResultItems || [];
      const jobs: RawDiscoveredJob[] = [];

      for (const item of items) {
        const desc = item.MatchedObjectDescriptor || {};
        if (!desc.PositionTitle) continue;

        const loc = desc.PositionLocation?.[0]?.LocationName || "United States";
        const rem = Boolean(desc.PositionSchedule?.[0]?.Code === "Telework" || /remote/i.test(loc));

        let salaryMin: number | null = null;
        let salaryMax: number | null = null;
        if (desc.PositionRemuneration?.[0]) {
          const remun = desc.PositionRemuneration[0];
          salaryMin = Number(remun.MinimumRange) || null;
          salaryMax = Number(remun.MaximumRange) || null;
        }

        jobs.push({
          sourceJobId: `usajobs_${desc.PositionID || desc.PositionURI}`,
          sourceUrl: desc.PositionURI || url,
          applicationUrl: desc.ApplyURI?.[0] || desc.PositionURI || url,
          title: desc.PositionTitle,
          companyName: desc.DepartmentName || desc.OrganizationName || "US Federal Government",
          description: desc.UserArea?.Details?.JobSummary || desc.PositionTitle,
          locationText: loc,
          workMode: rem ? "remote" : "onsite",
          employmentType: "full_time",
          salaryMin,
          salaryMax,
          salaryCurrency: "USD",
          salaryPeriod: "yearly",
          postedAt: desc.PublicationStartDate ? new Date(desc.PublicationStartDate).toISOString() : null,
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
