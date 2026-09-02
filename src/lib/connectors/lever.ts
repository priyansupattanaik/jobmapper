import { BaseSourceConnector, ConnectorFetchResult, RawDiscoveredJob } from "./base";
import { SourceType } from "../types";

export class LeverConnector extends BaseSourceConnector {
  id = "lever-ats";
  name = "Lever Verified ATS";
  sourceType: SourceType = "verified_ats";
  sourceUrl = "https://api.lever.co";
  retrievalMethod = "api" as const;
  reliabilityScore = 0.95;

  private companies: { slug: string; name: string; website: string }[];

  constructor(companies?: { slug: string; name: string; website: string }[]) {
    super();
    this.companies = companies || [
      { slug: "yelp", name: "Yelp", website: "https://www.yelp.com" },
      { slug: "figma", name: "Figma", website: "https://www.figma.com" }
    ];
  }

  async fetchJobs(): Promise<ConnectorFetchResult> {
    const allJobs: RawDiscoveredJob[] = [];
    const errors: string[] = [];
    let lastHttpStatus = 200;

    for (const comp of this.companies) {
      const url = `${this.sourceUrl}/v0/postings/${comp.slug}?mode=json`;
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
          errors.push(`Lever company ${comp.slug} returned status ${res.status}`);
          continue;
        }

        const data = await res.json();
        const postings = Array.isArray(data) ? data : [];

        for (const p of postings) {
          if (!p.text) continue;

          const locationText = p.categories?.location || "Unknown";
          const workplaceType = p.workplaceType || "";
          const isRemote = workplaceType === "remote" || /remote/i.test(locationText);

          allJobs.push({
            sourceJobId: `lever_${comp.slug}_${p.id}`,
            sourceUrl: p.hostedUrl || url,
            applicationUrl: p.applyUrl || p.hostedUrl || url,
            title: p.text,
            companyName: comp.name,
            companyWebsite: comp.website,
            description: (p.descriptionPlain || p.text).slice(0, 3000),
            locationText,
            workMode: isRemote ? "remote" : (workplaceType === "hybrid" ? "hybrid" : "onsite"),
            employmentType: p.categories?.commitment ? p.categories.commitment.toLowerCase().replace("-", "_") : "full_time",
            postedAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
            rawPayload: p
          });
        }
      } catch (err) {
        errors.push(`Error fetching Lever ${comp.slug}: ${(err as Error).message}`);
      }
    }

    return {
      jobs: allJobs,
      httpStatus: lastHttpStatus,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}
