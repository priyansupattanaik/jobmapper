import { describe, it, expect } from "vitest";
import { DeduplicationEngine } from "@/lib/pipeline/deduplicator";

describe("DeduplicationEngine Unit Tests", () => {
  it("produces deterministic SHA256 fingerprints for identical normalized jobs", () => {
    const hash1 = DeduplicationEngine.generateDeterministicHash({
      canonicalCompanyId: "comp_google",
      normalizedTitle: "Senior Software Engineer",
      city: "Mumbai",
      isRemote: false
    });

    const hash2 = DeduplicationEngine.generateDeterministicHash({
      canonicalCompanyId: "comp_google",
      normalizedTitle: "Senior Software Engineer",
      city: "Mumbai",
      isRemote: false
    });

    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64);
  });

  it("produces different hashes for different seniority levels", () => {
    const hashJunior = DeduplicationEngine.generateDeterministicHash({
      canonicalCompanyId: "comp_google",
      normalizedTitle: "Software Engineer",
      city: "Mumbai",
      isRemote: false
    });

    const hashSenior = DeduplicationEngine.generateDeterministicHash({
      canonicalCompanyId: "comp_google",
      normalizedTitle: "Senior Software Engineer",
      city: "Mumbai",
      isRemote: false
    });

    expect(hashJunior).not.toBe(hashSenior);
  });

  it("calculates token set similarity accurately", () => {
    const descA = "Looking for a React and TypeScript developer with frontend experience.";
    const descB = "We need a frontend developer with experience in React and TypeScript.";
    const similarity = DeduplicationEngine.tokenSimilarity(descA, descB);
    expect(similarity).toBeGreaterThan(0.6);

    const descC = "Seeking a senior accountant with GAAP taxation expertise.";
    const lowSim = DeduplicationEngine.tokenSimilarity(descA, descC);
    expect(lowSim).toBeLessThan(0.15);
  });
});

