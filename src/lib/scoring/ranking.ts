export interface RankingExplanation {
  matchPercentage: number;
  distanceLabel: string | null;
  verificationLabel: string;
  summaryBadge: string;
}

export class RankingEngine {
  static explainRanking(
    overallConfidence: number,
    distanceKm?: number | null,
    lastVerifiedAt?: string | null,
    isRemote?: boolean
  ): RankingExplanation {
    const matchPercentage = Math.round(overallConfidence * 100);

    let distanceLabel: string | null = null;
    if (isRemote) {
      distanceLabel = "Remote";
    } else if (distanceKm !== undefined && distanceKm !== null) {
      distanceLabel = `${distanceKm.toFixed(1)} km away`;
    }

    let verificationLabel = "Recently verified";
    if (lastVerifiedAt) {
      const diffHours = Math.round((Date.now() - new Date(lastVerifiedAt).getTime()) / (1000 * 60 * 60));
      if (diffHours < 24) {
        verificationLabel = diffHours <= 1 ? "Verified just now" : `Verified ${diffHours}h ago`;
      } else {
        const days = Math.round(diffHours / 24);
        verificationLabel = days === 1 ? "Verified yesterday" : `Verified ${days} days ago`;
      }
    }

    const parts = [`${matchPercentage}% match`];
    if (distanceLabel) parts.push(distanceLabel);
    parts.push(verificationLabel);

    return {
      matchPercentage,
      distanceLabel,
      verificationLabel,
      summaryBadge: parts.join(" · ")
    };
  }
}
