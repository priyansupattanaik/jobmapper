import { 
  Job, 
  RawSourceRecord, 
  JobAuditLog, 
  Company, 
  Source, 
  JobReport, 
  JobFilter, 
  NearbyJobsResult,
  JobStatus 
} from "../types";

export interface DatabaseProvider {
  name: string;
  init(): Promise<void>;
  close(): Promise<void>;

  // Sources
  upsertSource(source: Source): Promise<void>;
  getSource(id: string): Promise<Source | null>;
  getAllSources(): Promise<Source[]>;
  updateSourceStats(id: string, stats: Partial<Source>): Promise<void>;

  // Raw Source Records
  saveRawRecord(record: RawSourceRecord): Promise<void>;
  getRawRecord(id: string): Promise<RawSourceRecord | null>;

  // Companies
  upsertCompany(company: Company): Promise<void>;
  findCompanyByAlias(name: string): Promise<Company | null>;
  getCompany(id: string): Promise<Company | null>;

  // Jobs
  upsertJob(job: Job, auditLog?: JobAuditLog): Promise<void>;
  getJob(id: string): Promise<Job | null>;
  getJobWithDuplicates(id: string): Promise<{ job: Job; duplicates: Job[] } | null>;
  findDuplicateCandidates(companyId: string, normalizedTitle: string, locationKey: string): Promise<Job[]>;
  findNearbyJobs(filter: JobFilter): Promise<NearbyJobsResult>;
  searchJobs(filter: JobFilter): Promise<NearbyJobsResult>;
  updateJobStatus(id: string, status: JobStatus, details?: Record<string, any>): Promise<void>;
  getActiveJobsForVerification(limit?: number): Promise<Job[]>;

  // Audit Logs
  saveAuditLog(log: JobAuditLog): Promise<void>;
  getAuditLogs(jobId: string): Promise<JobAuditLog[]>;

  // Reports
  saveReport(report: JobReport): Promise<void>;
  getAllReports(): Promise<JobReport[]>;
  updateReportStatus(id: string, status: JobReport["status"]): Promise<void>;

  // Health & Stats
  getSystemHealth(): Promise<{
    status: string;
    totalJobs: number;
    activeJobs: number;
    staleJobs: number;
    expiredJobs: number;
    sourcesCount: number;
    dbType: string;
    dbLatencyMs: number;
  }>;
}
