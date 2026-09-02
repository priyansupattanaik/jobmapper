import crypto from "crypto";
import { DatabaseProvider } from "../db/adapter";
import { BaseSourceConnector, RawDiscoveredJob } from "../connectors/base";
import { CompanyResolver } from "./companyResolver";
import { DataNormalizer } from "./normalizer";
import { GeocoderService } from "./geocoder";
import { DeduplicationEngine } from "./deduplicator";
import { UrlValidator } from "./urlValidator";
import { FreshnessEngine } from "./freshness";
import { AIProvider } from "../ai/provider";
import { Job, RawSourceRecord, JobAuditLog, JobStatus } from "../types";

export interface IngestionRunReport {
  sourceId: string;
  runId: string;
  startedAt: string;
  completedAt: string;
  recordsFound: number;
  recordsParsed: number;
  recordsAccepted: number;
  recordsRejected: number;
  recordsDuplicate: number;
  errors: string[];
}

export class IngestionPipeline {
  private db: DatabaseProvider;
  private companyResolver: CompanyResolver;
  private geocoder: GeocoderService;
  private deduplicator: DeduplicationEngine;
  private urlValidator: UrlValidator;
  private aiProvider: AIProvider;

  constructor(
    db: DatabaseProvider,
    geocoder: GeocoderService,
    aiProvider: AIProvider
  ) {
    this.db = db;
    this.companyResolver = new CompanyResolver(db);
    this.geocoder = geocoder;
    this.deduplicator = new DeduplicationEngine(db);
    this.urlValidator = new UrlValidator(6000);
    this.aiProvider = aiProvider;
  }

  async runConnector(connector: BaseSourceConnector): Promise<IngestionRunReport> {
    const startedAt = new Date().toISOString();
    const runId = `run_${Date.now()}_${connector.id}`;
    const report: IngestionRunReport = {
      sourceId: connector.id,
      runId,
      startedAt,
      completedAt: startedAt,
      recordsFound: 0,
      recordsParsed: 0,
      recordsAccepted: 0,
      recordsRejected: 0,
      recordsDuplicate: 0,
      errors: []
    };

    // Update connector status in DB
    await this.db.updateSourceStats(connector.id, {
      last_attempted_retrieval: startedAt,
      parsing_status: "in_progress"
    });

    try {
      // 1. Fetch from source
      const fetchResult = await connector.fetchJobs();
      report.recordsFound = fetchResult.jobs.length;

      if (fetchResult.errors && fetchResult.errors.length > 0) {
        report.errors.push(...fetchResult.errors);
      }

      for (const raw of fetchResult.jobs) {
        try {
          const outcome = await this.processJob(connector, raw, runId);
          report.recordsParsed++;
          if (outcome === "ACCEPTED") report.recordsAccepted++;
          else if (outcome === "DUPLICATE") report.recordsDuplicate++;
          else report.recordsRejected++;
        } catch (jobErr) {
          report.recordsRejected++;
          report.errors.push(`Job ${raw.sourceJobId} failed: ${(jobErr as Error).message}`);
        }
      }

      report.completedAt = new Date().toISOString();

      // Update source statistics
      const source = await this.db.getSource(connector.id);
      const prevDiscovered = source?.jobs_discovered || 0;
      const prevAccepted = source?.jobs_accepted || 0;
      const prevRejected = source?.jobs_rejected || 0;
      const prevDuplicated = source?.jobs_duplicated || 0;

      await this.db.updateSourceStats(connector.id, {
        last_successful_retrieval: report.completedAt,
        http_status: fetchResult.httpStatus,
        parsing_status: "success",
        jobs_discovered: prevDiscovered + report.recordsFound,
        jobs_accepted: prevAccepted + report.recordsAccepted,
        jobs_rejected: prevRejected + report.recordsRejected,
        jobs_duplicated: prevDuplicated + report.recordsDuplicate,
        data_freshness: report.completedAt
      });
    } catch (err) {
      report.completedAt = new Date().toISOString();
      const errMsg = (err as Error).message;
      report.errors.push(errMsg);

      await this.db.updateSourceStats(connector.id, {
        parsing_status: "failed",
        error_logs: [{ timestamp: report.completedAt, message: errMsg }]
      });
    }

    return report;
  }

  async processJob(
    connector: BaseSourceConnector,
    raw: RawDiscoveredJob,
    runId: string
  ): Promise<"ACCEPTED" | "DUPLICATE" | "REJECTED"> {
    const now = new Date().toISOString();

    // Critical Schema Validation: Must have at least a title and application/source URL
    if (!raw.title || !raw.sourceUrl) {
      return "REJECTED";
    }

    // 1. Store Raw Source Record (Immutable)
    const rawPayloadStr = typeof raw.rawPayload === "string" ? raw.rawPayload : JSON.stringify(raw.rawPayload);
    const checksum = crypto.createHash("sha256").update(rawPayloadStr).digest("hex");
    const rawRecordId = `raw_${connector.id}_${raw.sourceJobId}_${Date.now().toString(36)}`;

    await this.db.saveRawRecord({
      id: rawRecordId,
      source_id: connector.id,
      external_job_id: raw.sourceJobId,
      raw_payload: rawPayloadStr,
      raw_url: raw.sourceUrl,
      ingested_at: now,
      checksum
    });

    // 2. Data Normalization
    const normalizedTitle = DataNormalizer.normalizeTitle(raw.title);
    const cleanedDescription = DataNormalizer.cleanHtml(raw.description);
    const workMode = DataNormalizer.normalizeWorkMode(raw.workMode, `${raw.title} ${raw.locationText}`);
    const isRemote = workMode === "remote" || /remote/i.test(raw.locationText);
    const isHybrid = workMode === "hybrid";
    const isOnsite = workMode === "onsite";

    const employmentType = DataNormalizer.normalizeEmploymentType(raw.employmentType);
    const salary = DataNormalizer.normalizeSalary(raw.salaryMin ? `${raw.salaryMin} - ${raw.salaryMax}` : undefined, raw.salaryCurrency || undefined);

    // 3. Company Entity Resolution
    const company = await this.companyResolver.resolveCompany(raw.companyName, raw.companyWebsite);

    // 4. Location Intelligence & Geocoding
    const geo = await this.geocoder.geocode(raw.locationText, isRemote);

    // 5. URL Validation
    const urlCheck = await this.urlValidator.validateUrl(raw.applicationUrl || raw.sourceUrl);
    const canonicalUrl = urlCheck.canonicalUrl || raw.applicationUrl || raw.sourceUrl;

    // 6. Deduplication Check
    const dedup = await this.deduplicator.checkDuplicate({
      normalized_title: normalizedTitle,
      title: raw.title,
      company_id: company.id,
      city: geo.city,
      remote: isRemote,
      canonical_url: canonicalUrl,
      source_reliability: connector.reliabilityScore,
      description: raw.description,
      source_job_id: raw.sourceJobId
    });

    // 7. AI Classification (Strictly Non-Hallucinatory)
    const aiClassification = await this.aiProvider.classifyJob({
      title: normalizedTitle,
      description: raw.description,
      requirements: []
    });

    // 8. Freshness & Scoring
    const freshness = FreshnessEngine.assessFreshness(now, raw.postedAt, urlCheck.isDeadPage);
    const completeness = DataNormalizer.calculateCompleteness({
      title: normalizedTitle,
      company_name: company.canonical_name,
      description: raw.description,
      location_text: raw.locationText,
      salary_min: salary.min,
      employment_type: employmentType,
      work_mode: workMode,
      skills: aiClassification.skills,
      application_url: canonicalUrl,
      posted_at: raw.postedAt
    });

    const verificationScore = urlCheck.isAccessible ? 1.0 : (urlCheck.isDeadPage ? 0.0 : 0.5);
    const overallConfidence = FreshnessEngine.calculateOverallConfidence({
      source_reliability: connector.reliabilityScore,
      verification_score: verificationScore,
      freshness_score: freshness.score,
      location_confidence: geo.confidence,
      data_completeness: completeness
    });

    // Status Determination
    let status: JobStatus = "ACTIVE";
    if (urlCheck.isDeadPage) {
      status = "EXPIRED";
    } else if (!dedup.isPrimary) {
      status = "DUPLICATE";
    } else if (freshness.status === "STALE") {
      status = "STALE";
    }

    const jobId = `job_${connector.id}_${raw.sourceJobId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
    const hash = DeduplicationEngine.generateDeterministicHash({
      canonicalCompanyId: company.id,
      normalizedTitle,
      city: geo.city,
      isRemote,
      sourceJobId: raw.sourceJobId
    });

    const jobRecord: Job = {
      id: jobId,
      source_id: connector.id,
      source_job_id: raw.sourceJobId,
      source_url: raw.sourceUrl,
      canonical_url: canonicalUrl,

      title: raw.title,
      normalized_title: normalizedTitle,

      company_name: company.canonical_name,
      company_id: company.id,
      company_verified: company.verified,

      description: cleanedDescription,
      short_description: cleanedDescription.substring(0, 280),

      employment_type: employmentType,
      work_mode: workMode,
      experience_level: aiClassification.experience_level,

      salary_min: salary.min,
      salary_max: salary.max,
      salary_currency: salary.currency,
      salary_period: salary.period,
      salary_verified: salary.verified,

      location_text: raw.locationText,
      city: geo.city,
      state: geo.state,
      country: geo.country,
      postal_code: geo.postal_code,

      latitude: geo.latitude,
      longitude: geo.longitude,
      geocoding_accuracy: geo.accuracy,

      remote: isRemote,
      hybrid: isHybrid,
      onsite: isOnsite,

      category: aiClassification.category,
      subcategory: aiClassification.subcategory,
      skills: aiClassification.skills,
      education_requirements: [],
      experience_requirements: [],

      posted_at: raw.postedAt || null,
      updated_at: now,
      application_deadline: null,

      discovered_at: now,
      last_verified_at: now,
      expires_at: null,

      status,
      duplicate_group_id: dedup.duplicateGroupId,
      is_primary_duplicate: dedup.isPrimary,

      source_reliability: connector.reliabilityScore,
      data_completeness: completeness,
      location_confidence: geo.confidence,
      freshness_score: freshness.score,
      verification_score: verificationScore,
      overall_confidence: overallConfidence,

      ai_classification: aiClassification as any,
      ai_classification_confidence: aiClassification.confidence,

      application_url: canonicalUrl,
      hash,
      created_at: now
    };

    const auditLog: JobAuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      job_id: jobId,
      stage: "INGESTION_COMPLETE",
      actor: `pipeline:${runId}`,
      details: {
        source_id: connector.id,
        dedup_result: dedup,
        url_validation: { status: urlCheck.httpStatus, canonical: canonicalUrl },
        geocoding: { accuracy: geo.accuracy, confidence: geo.confidence },
        ai_classification: { category: aiClassification.category, model: aiClassification.model }
      },
      created_at: now
    };

    await this.db.upsertJob(jobRecord, auditLog);

    if (status === "DUPLICATE") return "DUPLICATE";
    return "ACCEPTED";
  }
}
