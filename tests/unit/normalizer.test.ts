import { describe, it, expect } from "vitest";
import { DataNormalizer } from "@/lib/pipeline/normalizer";

describe("DataNormalizer Unit Tests", () => {
  it("normalizes job titles by removing recruitment tags and noise", () => {
    const raw = "[Remote] Senior Backend Engineer (m/w/d) - Urgent Requirement!";
    const normalized = DataNormalizer.normalizeTitle(raw);
    expect(normalized).toBe("Senior Backend Engineer");
  });

  it("normalizes work modes correctly without guesswork", () => {
    expect(DataNormalizer.normalizeWorkMode("remote", "")).toBe("remote");
    expect(DataNormalizer.normalizeWorkMode("", "100% Work from Home available")).toBe("remote");
    expect(DataNormalizer.normalizeWorkMode("hybrid", "3 days in office")).toBe("hybrid");
    expect(DataNormalizer.normalizeWorkMode("onsite", "Must work in Mumbai office")).toBe("onsite");
    expect(DataNormalizer.normalizeWorkMode(undefined, "Unknown policy")).toBe("unknown");
  });

  it("parses Indian Lakhs / LPA salary accurately", () => {
    const res = DataNormalizer.normalizeSalary("₹8–12 LPA", "INR");
    expect(res.verified).toBe(true);
    expect(res.min).toBe(800000);
    expect(res.max).toBe(1200000);
    expect(res.currency).toBe("INR");
    expect(res.period).toBe("yearly");
  });

  it("parses US dollar salary ranges accurately", () => {
    const res = DataNormalizer.normalizeSalary("$90k - $120k", "USD");
    expect(res.verified).toBe(true);
    expect(res.min).toBe(90000);
    expect(res.max).toBe(120000);
    expect(res.currency).toBe("USD");
    expect(res.period).toBe("yearly");
  });

  it("never invents salary when salary is undisclosed or missing", () => {
    const res1 = DataNormalizer.normalizeSalary(null);
    expect(res1.verified).toBe(false);
    expect(res1.min).toBeNull();
    expect(res1.max).toBeNull();

    const res2 = DataNormalizer.normalizeSalary("Competitive compensation");
    expect(res2.verified).toBe(false);
    expect(res2.min).toBeNull();
  });

  it("calculates data completeness ratio deterministically", () => {
    const complete = DataNormalizer.calculateCompleteness({
      title: "Software Engineer",
      company_name: "Google",
      description: "A detailed job description with more than fifty characters explaining the role.",
      location_text: "Mountain View, CA",
      salary_min: 150000,
      employment_type: "full_time",
      work_mode: "hybrid",
      application_url: "https://careers.google.com/jobs/123",
      posted_at: "2026-09-01T00:00:00Z"
    });
    expect(complete).toBe(1.0);

    const minimal = DataNormalizer.calculateCompleteness({
      title: "Unknown Role",
      company_name: "Unknown Employer"
    });
    expect(minimal).toBeLessThan(0.3);
  });
});
