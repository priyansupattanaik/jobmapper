import { JobStatus } from "../types";

export interface FreshnessAssessment {
  score: number;
  label: "Fresh" | "Recent" | "Aging" | "Stale";
  status: JobStatus;
  daysSinceVerification: number;
}

export class FreshnessEngine {
  static assessFreshness(lastVerifiedAt: string, postedAt?: string | null, isDeadPage: boolean = false): FreshnessAssessment {
    if (isDeadPage) {
      return {
        score: 0.0,
        label: "Stale",
        status: "EXPIRED",
        daysSinceVerification: 999
      };
    }

    const referenceDate = lastVerifiedAt ? new Date(lastVerifiedAt) : (postedAt ? new Date(postedAt) : new Date(0));
    const now = new Date();
    const diffMs = now.getTime() - referenceDate.getTime();
    const days = Math.max(0, diffMs / (1000 * 60 * 60 * 24));

    if (days <= 3) {
      return {
        score: 1.0,
        label: "Fresh",
        status: "ACTIVE",
        daysSinceVerification: Math.round(days)
      };
    } else if (days <= 7) {
      return {
        score: 0.8,
        label: "Recent",
        status: "ACTIVE",
        daysSinceVerification: Math.round(days)
      };
    } else if (days <= 30) {
      return {
        score: 0.5,
        label: "Aging",
        status: "ACTIVE",
        daysSinceVerification: Math.round(days)
      };
    } else {
      return {
        score: 0.2,
        label: "Stale",
        status: "STALE",
        daysSinceVerification: Math.round(days)
      };
    }
  }

  static calculateOverallConfidence(params: {
    source_reliability: number;
    verification_score: number;
    freshness_score: number;
    location_confidence: number;
    data_completeness: number;
  }): number {
    const raw = (
      0.35 * params.source_reliability +
      0.25 * params.verification_score +
      0.20 * params.freshness_score +
      0.15 * params.location_confidence +
      0.05 * params.data_completeness
    );
    return Number(Math.min(Math.max(raw, 0.0), 1.0).toFixed(2));
  }
}
