import crypto from "crypto";
import { Job } from "../types";
import { DatabaseProvider } from "../db/adapter";

export interface DeduplicationResult {
  isDuplicate: boolean;
  duplicateGroupId: string;
  isPrimary: boolean;
  matchedJobId?: string;
  confidence: number;
  reason?: string;
}

export class DeduplicationEngine {
  private db: DatabaseProvider;

  constructor(db: DatabaseProvider) {
    this.db = db;
  }

  // Deterministic Fingerprint
  static generateDeterministicHash(input: {
    canonicalCompanyId: string;
    normalizedTitle: string;
    city?: string | null;
    isRemote: boolean;
    sourceJobId?: string;
  }): string {
    const locToken = input.isRemote ? "remote" : (input.city?.toLowerCase().trim() || "unknown");
    const titleTokens = input.normalizedTitle.toLowerCase().replace(/[^\w]/g, " ").trim().split(/\s+/).sort().join(" ");
    const raw = `${input.canonicalCompanyId}::${titleTokens}::${locToken}`;
    return crypto.createHash("sha256").update(raw).digest("hex");
  }

  // Token Set Similarity / Jaccard for secondary check
  static tokenSimilarity(a: string, b: string): number {
    const setA = new Set(a.toLowerCase().replace(/[^\w]/g, " ").split(/\s+/).filter(Boolean));
    const setB = new Set(b.toLowerCase().replace(/[^\w]/g, " ").split(/\s+/).filter(Boolean));
    if (setA.size === 0 || setB.size === 0) return 0;

    let intersection = 0;
    for (const item of setA) {
      if (setB.has(item)) intersection++;
    }
    const union = new Set([...setA, ...setB]).size;
    return intersection / union;
  }

  async checkDuplicate(candidate: {
    normalized_title: string;
    title: string;
    company_id: string;
    city: string | null;
    remote: boolean;
    canonical_url: string;
    source_reliability: number;
    description: string;
    source_job_id: string;
  }): Promise<DeduplicationResult> {
    const locKey = candidate.remote ? "remote" : (candidate.city || "unknown");

    // 1. Check exact canonical URL or source job ID match
    const existingCandidates = await this.db.findDuplicateCandidates(
      candidate.company_id,
      candidate.normalized_title,
      locKey
    );

    for (const existing of existingCandidates) {
      // Direct URL match
      if (existing.canonical_url === candidate.canonical_url) {
        return this.resolveDuplicateGroup(candidate, existing, 1.0, "Exact canonical URL match");
      }

      // Exact title and company match in same location
      const titleMatch = existing.normalized_title.toLowerCase() === candidate.normalized_title.toLowerCase();
      if (titleMatch) {
        // Strict guard: verify seniority isn't mismatched
        const existingIsSenior = /\b(senior|lead|principal|staff|sr\.)\b/i.test(existing.title);
        const candidateIsSenior = /\b(senior|lead|principal|staff|sr\.)\b/i.test(candidate.title);
        const existingIsJunior = /\b(junior|entry|intern|associate|jr\.)\b/i.test(existing.title);
        const candidateIsJunior = /\b(junior|entry|intern|associate|jr\.)\b/i.test(candidate.title);

        if (existingIsSenior !== candidateIsSenior || existingIsJunior !== candidateIsJunior) {
          // Different seniority levels -> MUST NOT MERGE
          continue;
        }

        // Secondary description similarity
        const sim = DeduplicationEngine.tokenSimilarity(existing.description, candidate.description);
        if (sim >= 0.5 || existing.source_job_id === candidate.source_job_id) {
          return this.resolveDuplicateGroup(candidate, existing, 0.95, "Identical title, employer, and location with high description similarity");
        }
      }
    }

    // No duplicate found -> Fresh duplicate group
    const newGroupId = `grp_${crypto.randomUUID()}`;
    return {
      isDuplicate: false,
      duplicateGroupId: newGroupId,
      isPrimary: true,
      confidence: 1.0
    };
  }

  private resolveDuplicateGroup(
    candidate: { source_reliability: number },
    existing: Job,
    confidence: number,
    reason: string
  ): DeduplicationResult {
    // If incoming source has strictly higher reliability than existing primary
    const isHigherReliability = candidate.source_reliability > existing.source_reliability;

    return {
      isDuplicate: true,
      duplicateGroupId: existing.duplicate_group_id,
      isPrimary: isHigherReliability,
      matchedJobId: existing.id,
      confidence,
      reason
    };
  }
}
