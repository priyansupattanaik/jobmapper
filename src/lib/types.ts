import { z } from "zod";

// ==============================================================================
// ENUMS & CONSTANTS
// ==============================================================================

export const JobStatusEnum = z.enum([
  "DISCOVERED",
  "PARSING",
  "NORMALIZED",
  "VALIDATED",
  "VERIFIED",
  "ACTIVE",
  "STALE",
  "EXPIRED",
  "REMOVED",
  "REJECTED",
  "DUPLICATE"
]);
export type JobStatus = z.infer<typeof JobStatusEnum>;

export const EmploymentTypeEnum = z.enum([
  "full_time",
  "part_time",
  "contract",
  "internship",
  "apprenticeship",
  "temporary",
  "unknown"
]);
export type EmploymentType = z.infer<typeof EmploymentTypeEnum>;

export const WorkModeEnum = z.enum([
  "remote",
  "hybrid",
  "onsite",
  "unknown"
]);
export type WorkMode = z.infer<typeof WorkModeEnum>;

export const ExperienceLevelEnum = z.enum([
  "internship",
  "fresher",
  "entry_level",
  "mid_level",
  "senior",
  "executive",
  "unknown"
]);
export type ExperienceLevel = z.infer<typeof ExperienceLevelEnum>;

export const GeocodingAccuracyEnum = z.enum([
  "exact_address",
  "building_level",
  "street_level",
  "area_level",
  "city_level",
  "unknown"
]);
export type GeocodingAccuracy = z.infer<typeof GeocodingAccuracyEnum>;

export const SourceTypeEnum = z.enum([
  "official_career_page",
  "government_portal",
  "verified_ats",
  "established_job_board",
  "unverified_source"
]);
export type SourceType = z.infer<typeof SourceTypeEnum>;

export const ReportReasonEnum = z.enum([
  "job_no_longer_available",
  "incorrect_location",
  "incorrect_company",
  "misleading_information",
  "broken_application_link",
  "duplicate",
  "suspicious_fraudulent",
  "other"
]);
export type ReportReason = z.infer<typeof ReportReasonEnum>;

// ==============================================================================
// CORE DATA SCHEMAS
// ==============================================================================

export const JobSchema = z.object({
  id: z.string(),
  source_id: z.string(),
  source_job_id: z.string(),
  source_url: z.string(),
  canonical_url: z.string(),

  title: z.string(),
  normalized_title: z.string(),

  company_name: z.string(),
  company_id: z.string(),
  company_verified: z.boolean().default(false),

  description: z.string(),
  short_description: z.string().default(""),

  employment_type: EmploymentTypeEnum.default("unknown"),
  work_mode: WorkModeEnum.default("unknown"),
  experience_level: ExperienceLevelEnum.default("unknown"),

  salary_min: z.number().nullable().default(null),
  salary_max: z.number().nullable().default(null),
  salary_currency: z.string().nullable().default(null),
  salary_period: z.enum(["yearly", "monthly", "hourly"]).nullable().default(null),
  salary_verified: z.boolean().default(false),

  location_text: z.string().default("Unknown"),
  city: z.string().nullable().default(null),
  state: z.string().nullable().default(null),
  country: z.string().nullable().default(null),
  postal_code: z.string().nullable().default(null),

  latitude: z.number().nullable().default(null),
  longitude: z.number().nullable().default(null),
  geocoding_accuracy: GeocodingAccuracyEnum.default("unknown"),

  remote: z.boolean().default(false),
  hybrid: z.boolean().default(false),
  onsite: z.boolean().default(false),

  category: z.string().default("Other"),
  subcategory: z.string().default("General"),
  skills: z.array(z.string()).default([]),
  education_requirements: z.array(z.string()).default([]),
  experience_requirements: z.array(z.string()).default([]),

  posted_at: z.string().nullable().default(null),
  updated_at: z.string(),
  application_deadline: z.string().nullable().default(null),

  discovered_at: z.string(),
  last_verified_at: z.string(),
  expires_at: z.string().nullable().default(null),

  status: JobStatusEnum.default("ACTIVE"),
  duplicate_group_id: z.string(),
  is_primary_duplicate: z.boolean().default(true),

  source_reliability: z.number().min(0).max(1).default(0.5),
  data_completeness: z.number().min(0).max(1).default(0.5),
  location_confidence: z.number().min(0).max(1).default(0.0),
  freshness_score: z.number().min(0).max(1).default(1.0),
  verification_score: z.number().min(0).max(1).default(1.0),
  overall_confidence: z.number().min(0).max(1).default(0.5),

  ai_classification: z.record(z.any()).default({}),
  ai_classification_confidence: z.number().min(0).max(1).default(0.0),

  application_url: z.string(),
  hash: z.string(),
  created_at: z.string(),
  
  // Computed distance in km for geospatial queries (optional)
  distance_km: z.number().optional()
});
export type Job = z.infer<typeof JobSchema>;

export interface RawSourceRecord {
  id: string;
  source_id: string;
  external_job_id: string;
  raw_payload: string; // JSON or raw text string
  raw_url: string;
  ingested_at: string;
  checksum: string;
}

export interface JobAuditLog {
  id: string;
  job_id: string;
  stage: string;
  actor: string;
  details: Record<string, any>;
  created_at: string;
}

export interface Company {
  id: string;
  canonical_name: string;
  aliases: string[];
  website: string | null;
  industry: string | null;
  verified: boolean;
  source_count: number;
  created_at: string;
  updated_at: string;
}

export interface Source {
  id: string;
  name: string;
  source_type: SourceType;
  source_url: string;
  retrieval_method: "api" | "rss_feed" | "crawler";
  last_successful_retrieval: string | null;
  last_attempted_retrieval: string | null;
  http_status: number | null;
  parsing_status: "idle" | "in_progress" | "success" | "failed";
  jobs_discovered: number;
  jobs_accepted: number;
  jobs_rejected: number;
  jobs_duplicated: number;
  error_logs: Array<{ timestamp: string; message: string; code?: string }>;
  rate_limit_status: Record<string, any>;
  data_freshness: string | null;
  reliability_score: number;
  is_active: boolean;
}

export interface JobReport {
  id: string;
  job_id: string;
  reason: ReportReason;
  details: string;
  status: "pending" | "reviewed" | "dismissed" | "action_taken";
  created_at: string;
}

// ==============================================================================
// QUERY & FILTER SCHEMAS
// ==============================================================================

export const JobFilterSchema = z.object({
  query: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  location: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  radius_km: z.number().min(1).max(500).optional(),
  viewport: z.object({
    min_lat: z.number(),
    max_lat: z.number(),
    min_lng: z.number(),
    max_lng: z.number(),
  }).optional(),
  employment_type: z.array(EmploymentTypeEnum).optional(),
  work_mode: z.array(WorkModeEnum).optional(),
  experience_level: z.array(ExperienceLevelEnum).optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  skills: z.array(z.string()).optional(),
  salary_min: z.number().optional(),
  salary_max: z.number().optional(),
  salary_currency: z.string().optional(),
  freshness_days: z.number().optional(),
  remote_only: z.boolean().optional(),
  sort_by: z.enum(["relevance", "distance", "freshness", "salary", "confidence"]).default("relevance"),
  limit: z.number().min(1).max(200).default(50),
  offset: z.number().min(0).default(0)
});
export type JobFilter = z.infer<typeof JobFilterSchema>;

export interface NearbyJobsResult {
  jobs: Job[];
  total: number;
  coverage: {
    sources_count: number;
    radius_km: number | null;
    center: { lat: number; lng: number } | null;
    latest_verification: string | null;
  };
}
