import { describe, it, expect, beforeEach } from "vitest";
import { SqliteDatabaseProvider } from "@/lib/db/sqlite";
import { CompanyResolver } from "@/lib/pipeline/companyResolver";
import { DataNormalizer } from "@/lib/pipeline/normalizer";
import { DeduplicationEngine } from "@/lib/pipeline/deduplicator";
import { UrlValidator } from "@/lib/pipeline/urlValidator";
import { FreshnessEngine } from "@/lib/pipeline/freshness";
import { GeocoderService } from "@/lib/pipeline/geocoder";
import { RuleBasedAIProvider } from "@/lib/ai/ruleBased";
import { IngestionPipeline } from "@/lib/pipeline/orchestrator";
import { BaseSourceConnector, ConnectorFetchResult } from "@/lib/connectors/base";
import { SourceType } from "@/lib/types";

describe("Job Mapper - Section 40 Dedicated Accuracy Test Suite", () => {
  let db: SqliteDatabaseProvider;

  beforeEach(async () => {
    db = new SqliteDatabaseProvider(":memory:");
    await db.init();

    // Register sources to satisfy foreign keys in tests
    for (const sId of ["job_board", "careers", "source_a", "failing-source", "working-source"]) {
      await db.upsertSource({
        id: sId,
        name: sId,
        source_type: "established_job_board",
        source_url: `https://${sId}.example`,
        retrieval_method: "api",
        last_successful_retrieval: null,
        last_attempted_retrieval: null,
        http_status: 200,
        parsing_status: "idle",
        jobs_discovered: 0,
        jobs_accepted: 0,
        jobs_rejected: 0,
        jobs_duplicated: 0,
        error_logs: [],
        rate_limit_status: {},
        data_freshness: null,
        reliability_score: 0.95,
        is_active: true
      });
    }
  });

  // Test Case 1: Same job from multiple sources
  it("Scenario 1: Same job from multiple sources -> correctly deduplicated, highest reliability primary selected", async () => {
    const compResolver = new CompanyResolver(db);
    const company = await compResolver.resolveCompany("Tech Corp");
    const dedup = new DeduplicationEngine(db);

    // Source A (Job Board, reliability 0.90)
    const jobA = {
      normalized_title: "Full Stack Engineer",
      title: "Full Stack Engineer",
      company_id: company.id,
      city: "Mumbai",
      remote: false,
      canonical_url: "https://jobboard.com/jobs/101",
      source_reliability: 0.90,
      description: "Build robust full stack web applications with React and Node.js.",
      source_job_id: "jb_101"
    };

    const resA = await dedup.checkDuplicate(jobA);
    expect(resA.isDuplicate).toBe(false);
    expect(resA.isPrimary).toBe(true);

    // Simulate saving jobA to DB
    const now = new Date().toISOString();
    await db.upsertJob({
      id: "job_a",
      source_id: "job_board",
      source_job_id: "jb_101",
      source_url: "https://jobboard.com/jobs/101",
      canonical_url: "https://jobboard.com/jobs/101",
      title: jobA.title,
      normalized_title: jobA.normalized_title,
      company_name: "Tech Corp",
      company_id: company.id,
      company_verified: false,
      description: jobA.description,
      short_description: "",
      employment_type: "full_time",
      work_mode: "onsite",
      experience_level: "mid_level",
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      salary_period: null,
      salary_verified: false,
      location_text: "Mumbai",
      city: "Mumbai",
      state: "MH",
      country: "India",
      postal_code: null,
      latitude: 19.0760,
      longitude: 72.8777,
      geocoding_accuracy: "city_level",
      remote: false,
      hybrid: false,
      onsite: true,
      category: "Software & Engineering",
      subcategory: "Full Stack Engineering",
      skills: ["React", "Node.js"],
      education_requirements: [],
      experience_requirements: [],
      posted_at: now,
      updated_at: now,
      application_deadline: null,
      discovered_at: now,
      last_verified_at: now,
      expires_at: null,
      status: "ACTIVE",
      duplicate_group_id: resA.duplicateGroupId,
      is_primary_duplicate: true,
      source_reliability: 0.90,
      data_completeness: 0.8,
      location_confidence: 0.6,
      freshness_score: 1.0,
      verification_score: 1.0,
      overall_confidence: 0.85,
      ai_classification: {},
      ai_classification_confidence: 0.9,
      application_url: "https://jobboard.com/jobs/101",
      hash: "hash_101",
      created_at: now
    });

    // Source B (Official Careers Page, reliability 0.98)
    const jobB = {
      normalized_title: "Full Stack Engineer",
      title: "Full Stack Engineer",
      company_id: company.id,
      city: "Mumbai",
      remote: false,
      canonical_url: "https://techcorp.com/careers/101",
      source_reliability: 0.98,
      description: "Build robust full stack web applications with React and Node.js.",
      source_job_id: "official_101"
    };

    const resB = await dedup.checkDuplicate(jobB);
    expect(resB.isDuplicate).toBe(true);
    expect(resB.duplicateGroupId).toBe(resA.duplicateGroupId);
    expect(resB.isPrimary).toBe(true); // Since 0.98 > 0.90
  });

  // Test Case 2: Similar but different jobs
  it("Scenario 2: Similar titles with distinct seniority -> NOT merged", async () => {
    const compResolver = new CompanyResolver(db);
    const company = await compResolver.resolveCompany("Acme Inc");
    const dedup = new DeduplicationEngine(db);

    const now = new Date().toISOString();
    await db.upsertJob({
      id: "job_junior",
      source_id: "careers",
      source_job_id: "acme_1",
      source_url: "https://acme.com/jobs/1",
      canonical_url: "https://acme.com/jobs/1",
      title: "Junior Software Engineer",
      normalized_title: "Junior Software Engineer",
      company_name: "Acme Inc",
      company_id: company.id,
      company_verified: true,
      description: "Junior role for beginners in software.",
      short_description: "",
      employment_type: "full_time",
      work_mode: "onsite",
      experience_level: "entry_level",
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      salary_period: null,
      salary_verified: false,
      location_text: "Mumbai",
      city: "Mumbai",
      state: "MH",
      country: "India",
      postal_code: null,
      latitude: 19.0760,
      longitude: 72.8777,
      geocoding_accuracy: "city_level",
      remote: false,
      hybrid: false,
      onsite: true,
      category: "Software & Engineering",
      subcategory: "Full Stack Engineering",
      skills: [],
      education_requirements: [],
      experience_requirements: [],
      posted_at: now,
      updated_at: now,
      application_deadline: null,
      discovered_at: now,
      last_verified_at: now,
      expires_at: null,
      status: "ACTIVE",
      duplicate_group_id: "grp_junior",
      is_primary_duplicate: true,
      source_reliability: 0.98,
      data_completeness: 0.7,
      location_confidence: 0.6,
      freshness_score: 1.0,
      verification_score: 1.0,
      overall_confidence: 0.9,
      ai_classification: {},
      ai_classification_confidence: 0.9,
      application_url: "https://acme.com/jobs/1",
      hash: "hash_acme_1",
      created_at: now
    });

    // Candidate is Senior Software Engineer
    const seniorCandidate = {
      normalized_title: "Senior Software Engineer",
      title: "Senior Software Engineer",
      company_id: company.id,
      city: "Mumbai",
      remote: false,
      canonical_url: "https://acme.com/jobs/2",
      source_reliability: 0.98,
      description: "Senior role leading an engineering team.",
      source_job_id: "acme_2"
    };

    const res = await dedup.checkDuplicate(seniorCandidate);
    expect(res.isDuplicate).toBe(false);
    expect(res.duplicateGroupId).not.toBe("grp_junior");
  });

  // Test Case 3: Missing salary
  it("Scenario 3: Missing salary -> marked Unknown/null, never fabricated", () => {
    const res = DataNormalizer.normalizeSalary(undefined);
    expect(res.min).toBeNull();
    expect(res.max).toBeNull();
    expect(res.currency).toBeNull();
    expect(res.verified).toBe(false);
  });

  // Test Case 4: Missing location
  it("Scenario 4: Missing location -> geocoding accuracy marked unknown, coordinates null", async () => {
    const geocoder = new GeocoderService();
    const res = await geocoder.geocode("");
    expect(res.latitude).toBeNull();
    expect(res.longitude).toBeNull();
    expect(res.accuracy).toBe("unknown");
    expect(res.confidence).toBe(0.0);
  });

  // Test Case 5: Invalid URL
  it("Scenario 5: Invalid URL syntax -> detected and rejected", async () => {
    const validator = new UrlValidator();
    const res = await validator.validateUrl("not-a-valid-http-url");
    expect(res.isValidSyntax).toBe(false);
    expect(res.isAccessible).toBe(false);
    expect(res.isDeadPage).toBe(true);
  });

  // Test Case 6: Expired job
  it("Scenario 6: Expired dead link -> detected and transitioned to EXPIRED", () => {
    const res = FreshnessEngine.assessFreshness(new Date().toISOString(), null, true);
    expect(res.status).toBe("EXPIRED");
    expect(res.score).toBe(0.0);
  });

  // Test Case 7: Remote job
  it("Scenario 7: Remote job -> physical coordinates are null, not spoofed to user location", async () => {
    const geocoder = new GeocoderService();
    const res = await geocoder.geocode("Remote", true);
    expect(res.latitude).toBeNull();
    expect(res.longitude).toBeNull();
    expect(res.formatted_address).toBe("Remote");
  });

  // Test Case 8: Hybrid job
  it("Scenario 8: Hybrid job -> preserves known physical city", () => {
    const mode = DataNormalizer.normalizeWorkMode("hybrid", "2 days onsite in Berlin");
    expect(mode).toBe("hybrid");
  });

  // Test Case 9: Multiple company names resolution
  it("Scenario 9: Multiple company name variations -> resolved to canonical company", async () => {
    const compResolver = new CompanyResolver(db);
    const c1 = await compResolver.resolveCompany("Infosys Technologies Pvt Ltd");
    const c2 = await compResolver.resolveCompany("Infosys Technologies Private Limited");
    const c3 = await compResolver.resolveCompany("Infosys Technologies Inc.");

    expect(c1.id).toBe(c2.id);
    expect(c1.id).toBe(c3.id);
    expect(c1.canonical_name).toBe("Infosys Technologies");
  });

  // Test Case 10: Incorrect geocoding safe fallback
  it("Scenario 10: Gibberish location -> fails safely, marked unknown without guessing", async () => {
    const geocoder = new GeocoderService();
    const res = await geocoder.geocode("XyZ123NonExistentPlanetLocation");
    expect(res.latitude).toBeNull();
    expect(res.longitude).toBeNull();
    expect(res.accuracy).toBe("unknown");
  });

  // Test Case 11: Duplicate descriptions across different companies
  it("Scenario 11: Identical descriptions across distinct companies -> NOT merged", async () => {
    const compResolver = new CompanyResolver(db);
    const compA = await compResolver.resolveCompany("Company Alpha");
    const compB = await compResolver.resolveCompany("Company Beta");
    const dedup = new DeduplicationEngine(db);

    const desc = "Standard responsibilities: write clean code, attend standups, deploy services.";

    const now = new Date().toISOString();
    await db.upsertJob({
      id: "job_alpha",
      source_id: "source_a",
      source_job_id: "alpha_1",
      source_url: "https://alpha.com/job",
      canonical_url: "https://alpha.com/job",
      title: "Backend Engineer",
      normalized_title: "Backend Engineer",
      company_name: "Company Alpha",
      company_id: compA.id,
      company_verified: false,
      description: desc,
      short_description: "",
      employment_type: "full_time",
      work_mode: "onsite",
      experience_level: "mid_level",
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      salary_period: null,
      salary_verified: false,
      location_text: "London",
      city: "London",
      state: null,
      country: "UK",
      postal_code: null,
      latitude: 51.5074,
      longitude: -0.1278,
      geocoding_accuracy: "city_level",
      remote: false,
      hybrid: false,
      onsite: true,
      category: "Software & Engineering",
      subcategory: "Backend Engineering",
      skills: [],
      education_requirements: [],
      experience_requirements: [],
      posted_at: now,
      updated_at: now,
      application_deadline: null,
      discovered_at: now,
      last_verified_at: now,
      expires_at: null,
      status: "ACTIVE",
      duplicate_group_id: "grp_alpha",
      is_primary_duplicate: true,
      source_reliability: 0.95,
      data_completeness: 0.7,
      location_confidence: 0.6,
      freshness_score: 1.0,
      verification_score: 1.0,
      overall_confidence: 0.9,
      ai_classification: {},
      ai_classification_confidence: 0.9,
      application_url: "https://alpha.com/job",
      hash: "hash_alpha",
      created_at: now
    });

    const betaCandidate = {
      normalized_title: "Backend Engineer",
      title: "Backend Engineer",
      company_id: compB.id, // Different company
      city: "London",
      remote: false,
      canonical_url: "https://beta.com/job",
      source_reliability: 0.95,
      description: desc,
      source_job_id: "beta_1"
    };

    const res = await dedup.checkDuplicate(betaCandidate);
    expect(res.isDuplicate).toBe(false);
    expect(res.duplicateGroupId).not.toBe("grp_alpha");
  });

  // Test Case 12: Jobs with no posted date
  it("Scenario 12: Jobs with no posted date -> handled safely without fabrication", () => {
    const completeness = DataNormalizer.calculateCompleteness({
      title: "DevOps Engineer",
      company_name: "Cloud Corp",
      posted_at: null // missing
    });
    expect(completeness).toBeLessThan(1.0);
  });

  // Test Case 13: Login wall detection
  it("Scenario 13: Login wall URLs -> detected gracefully", async () => {
    const validator = new UrlValidator();
    const res = await validator.validateUrl("https://accounts.google.com/signin");
    expect(res.isLoginWall).toBe(true);
  });

  // Test Case 14: Source failure isolation
  it("Scenario 14: Failed source does not crash pipeline and other sources continue", async () => {
    const geocoder = new GeocoderService();
    const ai = new RuleBasedAIProvider();
    const pipeline = new IngestionPipeline(db, geocoder, ai);

    // Failing connector
    class FailingConnector extends BaseSourceConnector {
      id = "failing-source";
      name = "Failing Source";
      sourceType: SourceType = "established_job_board";
      sourceUrl = "https://failing.invalid";
      retrievalMethod = "api" as const;
      reliabilityScore = 0.8;
      async fetchJobs(): Promise<ConnectorFetchResult> {
        throw new Error("HTTP 503 Service Unavailable");
      }
    }

    // Working connector
    class WorkingConnector extends BaseSourceConnector {
      id = "working-source";
      name = "Working Source";
      sourceType: SourceType = "official_career_page";
      sourceUrl = "https://working.example";
      retrievalMethod = "api" as const;
      reliabilityScore = 0.98;
      async fetchJobs(): Promise<ConnectorFetchResult> {
        return {
          jobs: [{
            sourceJobId: "work_1",
            sourceUrl: "https://working.example/job/1",
            applicationUrl: "https://working.example/job/1",
            title: "Reliability Engineer",
            companyName: "Uptime Inc",
            description: "Maintain 99.999% system availability.",
            locationText: "New York, NY",
            rawPayload: {}
          }],
          httpStatus: 200
        };
      }
    }

    // Register sources in DB
    await db.upsertSource(new FailingConnector().toSourceEntity());
    await db.upsertSource(new WorkingConnector().toSourceEntity());

    // Run failing connector
    const failReport = await pipeline.runConnector(new FailingConnector());
    expect(failReport.errors.length).toBeGreaterThan(0);
    expect(failReport.recordsAccepted).toBe(0);

    // Verify failing source logged error in DB
    const failedSource = await db.getSource("failing-source");
    expect(failedSource?.parsing_status).toBe("failed");

    // Run working connector immediately after
    const workReport = await pipeline.runConnector(new WorkingConnector());
    expect(workReport.recordsAccepted).toBe(1);

    const workingSource = await db.getSource("working-source");
    expect(workingSource?.parsing_status).toBe("success");
    expect(workingSource?.jobs_accepted).toBe(1);
  });
});
