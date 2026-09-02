import { Company } from "../types";
import { DatabaseProvider } from "../db/adapter";

export class CompanyResolver {
  private db: DatabaseProvider;

  // Standard legal entity suffixes to strip for canonicalization
  private static SUFFIXES = [
    /\b(private\s+limited|pvt\.?\s*ltd\.?|pvt\s+limited)\b/gi,
    /\b(limited|ltd\.?)\b/gi,
    /\b(incorporated|inc\.?)\b/gi,
    /\b(corporation|corp\.?)\b/gi,
    /\b(llc|l\.l\.c\.)\b/gi,
    /\b(llp|l\.l\.p\.)\b/gi,
    /\b(gmbh|ag|s\.a\.|s\.r\.l\.|bv|co\.|company)\b/gi
  ];

  constructor(db: DatabaseProvider) {
    this.db = db;
  }

  static canonicalizeName(rawName: string): string {
    if (!rawName) return "Unknown Employer";
    let cleaned = rawName.trim();
    for (const suffix of this.SUFFIXES) {
      cleaned = cleaned.replace(suffix, "");
    }
    // Remove trailing commas, periods, dashes
    cleaned = cleaned.replace(/[,.\-_]+$/, "").trim();
    return cleaned.length > 0 ? cleaned : rawName.trim();
  }

  async resolveCompany(rawName: string, website?: string, industry?: string): Promise<Company> {
    const rawClean = (rawName || "").trim();
    if (!rawClean) {
      return {
        id: "company_unknown",
        canonical_name: "Unknown Employer",
        aliases: [],
        website: null,
        industry: null,
        verified: false,
        source_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }

    const canonical = CompanyResolver.canonicalizeName(rawClean);

    // 1. Check if canonical company or alias exists in DB
    const existing = await this.db.findCompanyByAlias(canonical) || await this.db.findCompanyByAlias(rawClean);

    if (existing) {
      const aliasSet = new Set(existing.aliases.map(a => a.toLowerCase()));
      let updated = false;
      if (!aliasSet.has(rawClean.toLowerCase())) {
        existing.aliases.push(rawClean);
        updated = true;
      }
      if (website && !existing.website) {
        existing.website = website;
        updated = true;
      }
      if (industry && !existing.industry) {
        existing.industry = industry;
        updated = true;
      }
      existing.source_count += 1;
      existing.updated_at = new Date().toISOString();

      await this.db.upsertCompany(existing);
      return existing;
    }

    // 2. Create new company entity
    const now = new Date().toISOString();
    const id = `comp_${canonical.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 30)}_${Date.now().toString(36)}`;
    const newCompany: Company = {
      id,
      canonical_name: canonical,
      aliases: rawClean.toLowerCase() !== canonical.toLowerCase() ? [rawClean] : [],
      website: website || null,
      industry: industry || null,
      verified: false,
      source_count: 1,
      created_at: now,
      updated_at: now
    };

    await this.db.upsertCompany(newCompany);
    return newCompany;
  }
}
