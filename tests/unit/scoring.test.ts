import { describe, it, expect } from "vitest";
import { FreshnessEngine } from "@/lib/pipeline/freshness";
import { RankingEngine } from "@/lib/scoring/ranking";

describe("Freshness and Scoring Unit Tests", () => {
  it("classifies jobs verified today as Fresh with 1.0 score", () => {
    const now = new Date().toISOString();
    const assessment = FreshnessEngine.assessFreshness(now, now, false);
    expect(assessment.label).toBe("Fresh");
    expect(assessment.score).toBe(1.0);
    expect(assessment.status).toBe("ACTIVE");
  });

  it("classifies jobs older than 31 days as Stale", () => {
    const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    const assessment = FreshnessEngine.assessFreshness(old, old, false);
    expect(assessment.label).toBe("Stale");
    expect(assessment.score).toBe(0.2);
    expect(assessment.status).toBe("STALE");
  });

  it("marks dead pages immediately as EXPIRED with score 0.0", () => {
    const now = new Date().toISOString();
    const assessment = FreshnessEngine.assessFreshness(now, now, true);
    expect(assessment.status).toBe("EXPIRED");
    expect(assessment.score).toBe(0.0);
  });

  it("calculates overall confidence strictly within 0.0 to 1.0", () => {
    const confidence = FreshnessEngine.calculateOverallConfidence({
      source_reliability: 0.95,
      verification_score: 1.0,
      freshness_score: 1.0,
      location_confidence: 0.9,
      data_completeness: 0.8
    });
    expect(confidence).toBeGreaterThanOrEqual(0.9);
    expect(confidence).toBeLessThanOrEqual(1.0);
  });

  it("generates transparent ranking explanations", () => {
    const explanation = RankingEngine.explainRanking(0.96, 4.2, new Date().toISOString(), false);
    expect(explanation.matchPercentage).toBe(96);
    expect(explanation.distanceLabel).toBe("4.2 km away");
    expect(explanation.summaryBadge).toContain("96% match");
    expect(explanation.summaryBadge).toContain("4.2 km away");
  });
});
