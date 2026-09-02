import { createClient, Client } from "@libsql/client";
import { DatabaseProvider } from "./adapter";
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

export class SqliteDatabaseProvider implements DatabaseProvider {
  name = "sqlite";
  private client: Client;
  private dbPath: string;

  constructor(dbPath: string = process.env.SQLITE_DB_PATH || "./jobmapper.db") {
    this.dbPath = dbPath;
    this.client = createClient({
      url: dbPath.startsWith("file:") ? dbPath : `file:${dbPath}`
    });
  }

  async init(): Promise<void> {
    await this.client.execute("PRAGMA journal_mode = WAL;");
    await this.client.execute("PRAGMA foreign_keys = ON;");

    // 1. Sources Table
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_url TEXT NOT NULL,
        retrieval_method TEXT NOT NULL,
        last_successful_retrieval TEXT,
        last_attempted_retrieval TEXT,
        http_status INTEGER,
        parsing_status TEXT NOT NULL,
        jobs_discovered INTEGER DEFAULT 0,
        jobs_accepted INTEGER DEFAULT 0,
        jobs_rejected INTEGER DEFAULT 0,
        jobs_duplicated INTEGER DEFAULT 0,
        error_logs TEXT DEFAULT '[]',
        rate_limit_status TEXT DEFAULT '{}',
        data_freshness TEXT,
        reliability_score REAL NOT NULL,
        is_active INTEGER DEFAULT 1
      );
    `);

    // 2. Raw Source Records Table (Immutable Source Records)
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS raw_source_records (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        external_job_id TEXT NOT NULL,
        raw_payload TEXT NOT NULL,
        raw_url TEXT NOT NULL,
        ingested_at TEXT NOT NULL,
        checksum TEXT NOT NULL,
        FOREIGN KEY (source_id) REFERENCES sources(id)
      );
    `);

    // 3. Companies Table (Entity Resolution)
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS companies (
        id TEXT PRIMARY KEY,
        canonical_name TEXT UNIQUE NOT NULL,
        aliases TEXT DEFAULT '[]',
        website TEXT,
        industry TEXT,
        verified INTEGER DEFAULT 0,
        source_count INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // 4. Jobs Table
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        source_job_id TEXT NOT NULL,
        source_url TEXT NOT NULL,
        canonical_url TEXT NOT NULL,

        title TEXT NOT NULL,
        normalized_title TEXT NOT NULL,

        company_name TEXT NOT NULL,
        company_id TEXT NOT NULL,
        company_verified INTEGER DEFAULT 0,

        description TEXT NOT NULL,
        short_description TEXT DEFAULT '',

        employment_type TEXT NOT NULL,
        work_mode TEXT NOT NULL,
        experience_level TEXT NOT NULL,

        salary_min REAL,
        salary_max REAL,
        salary_currency TEXT,
        salary_period TEXT,
        salary_verified INTEGER DEFAULT 0,

        location_text TEXT NOT NULL,
        city TEXT,
        state TEXT,
        country TEXT,
        postal_code TEXT,

        latitude REAL,
        longitude REAL,
        geocoding_accuracy TEXT NOT NULL,

        remote INTEGER DEFAULT 0,
        hybrid INTEGER DEFAULT 0,
        onsite INTEGER DEFAULT 0,

        category TEXT NOT NULL,
        subcategory TEXT NOT NULL,
        skills TEXT DEFAULT '[]',
        education_requirements TEXT DEFAULT '[]',
        experience_requirements TEXT DEFAULT '[]',

        posted_at TEXT,
        updated_at TEXT NOT NULL,
        application_deadline TEXT,

        discovered_at TEXT NOT NULL,
        last_verified_at TEXT NOT NULL,
        expires_at TEXT,

        status TEXT NOT NULL,
        duplicate_group_id TEXT NOT NULL,
        is_primary_duplicate INTEGER DEFAULT 1,

        source_reliability REAL NOT NULL,
        data_completeness REAL NOT NULL,
        location_confidence REAL NOT NULL,
        freshness_score REAL NOT NULL,
        verification_score REAL NOT NULL,
        overall_confidence REAL NOT NULL,

        ai_classification TEXT DEFAULT '{}',
        ai_classification_confidence REAL DEFAULT 0.0,

        application_url TEXT NOT NULL,
        hash TEXT NOT NULL,
        created_at TEXT NOT NULL,

        FOREIGN KEY (source_id) REFERENCES sources(id),
        FOREIGN KEY (company_id) REFERENCES companies(id)
      );
    `);

    // 5. Job Audit Logs (Traceability)
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS job_audit_logs (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        stage TEXT NOT NULL,
        actor TEXT NOT NULL,
        details TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    // 6. Job Reports
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS job_reports (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        details TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    // Spatial & Query Indexes
    await this.client.execute(`CREATE INDEX IF NOT EXISTS idx_jobs_spatial ON jobs(latitude, longitude) WHERE status = 'ACTIVE' AND latitude IS NOT NULL;`);
    await this.client.execute(`CREATE INDEX IF NOT EXISTS idx_jobs_hash ON jobs(hash);`);
    await this.client.execute(`CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);`);
    await this.client.execute(`CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs(company_id);`);
    await this.client.execute(`CREATE INDEX IF NOT EXISTS idx_jobs_duplicate_group ON jobs(duplicate_group_id);`);
    await this.client.execute(`CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category);`);
    await this.client.execute(`CREATE INDEX IF NOT EXISTS idx_jobs_freshness ON jobs(last_verified_at);`);
    await this.client.execute(`CREATE INDEX IF NOT EXISTS idx_jobs_work_mode ON jobs(work_mode);`);
  }

  async close(): Promise<void> {
    await this.client.close();
  }

  // ============================================================================
  // SOURCES
  // ============================================================================

  async upsertSource(source: Source): Promise<void> {
    await this.client.execute({
      sql: `
        INSERT INTO sources (
          id, name, source_type, source_url, retrieval_method,
          last_successful_retrieval, last_attempted_retrieval, http_status,
          parsing_status, jobs_discovered, jobs_accepted, jobs_rejected,
          jobs_duplicated, error_logs, rate_limit_status, data_freshness,
          reliability_score, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          source_type = excluded.source_type,
          source_url = excluded.source_url,
          retrieval_method = excluded.retrieval_method,
          last_successful_retrieval = COALESCE(excluded.last_successful_retrieval, sources.last_successful_retrieval),
          last_attempted_retrieval = excluded.last_attempted_retrieval,
          http_status = excluded.http_status,
          parsing_status = excluded.parsing_status,
          jobs_discovered = excluded.jobs_discovered,
          jobs_accepted = excluded.jobs_accepted,
          jobs_rejected = excluded.jobs_rejected,
          jobs_duplicated = excluded.jobs_duplicated,
          error_logs = excluded.error_logs,
          rate_limit_status = excluded.rate_limit_status,
          data_freshness = excluded.data_freshness,
          reliability_score = excluded.reliability_score,
          is_active = excluded.is_active;
      `,
      args: [
        source.id, source.name, source.source_type, source.source_url, source.retrieval_method,
        source.last_successful_retrieval, source.last_attempted_retrieval, source.http_status,
        source.parsing_status, source.jobs_discovered, source.jobs_accepted, source.jobs_rejected,
        source.jobs_duplicated, JSON.stringify(source.error_logs || []), JSON.stringify(source.rate_limit_status || {}),
        source.data_freshness, source.reliability_score, source.is_active ? 1 : 0
      ]
    });
  }

  async getSource(id: string): Promise<Source | null> {
    const res = await this.client.execute({
      sql: `SELECT * FROM sources WHERE id = ?`,
      args: [id]
    });
    if (res.rows.length === 0) return null;
    return this.mapSourceRow(res.rows[0]);
  }

  async getAllSources(): Promise<Source[]> {
    const res = await this.client.execute(`SELECT * FROM sources ORDER BY reliability_score DESC, name ASC`);
    return res.rows.map(r => this.mapSourceRow(r));
  }

  async updateSourceStats(id: string, stats: Partial<Source>): Promise<void> {
    const sets: string[] = [];
    const args: any[] = [];
    for (const [key, value] of Object.entries(stats)) {
      sets.push(`${key} = ?`);
      args.push(typeof value === "object" ? JSON.stringify(value) : value);
    }
    if (sets.length === 0) return;
    args.push(id);
    await this.client.execute({
      sql: `UPDATE sources SET ${sets.join(", ")} WHERE id = ?`,
      args
    });
  }

  // ============================================================================
  // RAW SOURCE RECORDS
  // ============================================================================

  async saveRawRecord(record: RawSourceRecord): Promise<void> {
    await this.client.execute({
      sql: `
        INSERT OR REPLACE INTO raw_source_records (
          id, source_id, external_job_id, raw_payload, raw_url, ingested_at, checksum
        ) VALUES (?, ?, ?, ?, ?, ?, ?);
      `,
      args: [
        record.id, record.source_id, record.external_job_id,
        record.raw_payload, record.raw_url, record.ingested_at, record.checksum
      ]
    });
  }

  async getRawRecord(id: string): Promise<RawSourceRecord | null> {
    const res = await this.client.execute({
      sql: `SELECT * FROM raw_source_records WHERE id = ?`,
      args: [id]
    });
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: String(r.id),
      source_id: String(r.source_id),
      external_job_id: String(r.external_job_id),
      raw_payload: String(r.raw_payload),
      raw_url: String(r.raw_url),
      ingested_at: String(r.ingested_at),
      checksum: String(r.checksum)
    };
  }

  // ============================================================================
  // COMPANIES
  // ============================================================================

  async upsertCompany(company: Company): Promise<void> {
    await this.client.execute({
      sql: `
        INSERT INTO companies (
          id, canonical_name, aliases, website, industry, verified, source_count, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          canonical_name = excluded.canonical_name,
          aliases = excluded.aliases,
          website = COALESCE(excluded.website, companies.website),
          industry = COALESCE(excluded.industry, companies.industry),
          verified = excluded.verified,
          source_count = excluded.source_count,
          updated_at = excluded.updated_at;
      `,
      args: [
        company.id, company.canonical_name, JSON.stringify(company.aliases || []),
        company.website, company.industry, company.verified ? 1 : 0, company.source_count,
        company.created_at, company.updated_at
      ]
    });
  }

  async findCompanyByAlias(name: string): Promise<Company | null> {
    const normalized = name.trim().toLowerCase();
    const res = await this.client.execute({
      sql: `SELECT * FROM companies WHERE LOWER(canonical_name) = ? OR aliases LIKE ? LIMIT 1`,
      args: [normalized, `%"${normalized}"%`]
    });
    if (res.rows.length === 0) return null;
    return this.mapCompanyRow(res.rows[0]);
  }

  async getCompany(id: string): Promise<Company | null> {
    const res = await this.client.execute({
      sql: `SELECT * FROM companies WHERE id = ?`,
      args: [id]
    });
    if (res.rows.length === 0) return null;
    return this.mapCompanyRow(res.rows[0]);
  }

  // ============================================================================
  // JOBS
  // ============================================================================

  async upsertJob(job: Job, auditLog?: JobAuditLog): Promise<void> {
    await this.client.execute({
      sql: `
        INSERT INTO jobs (
          id, source_id, source_job_id, source_url, canonical_url,
          title, normalized_title, company_name, company_id, company_verified,
          description, short_description, employment_type, work_mode, experience_level,
          salary_min, salary_max, salary_currency, salary_period, salary_verified,
          location_text, city, state, country, postal_code,
          latitude, longitude, geocoding_accuracy,
          remote, hybrid, onsite, category, subcategory,
          skills, education_requirements, experience_requirements,
          posted_at, updated_at, application_deadline,
          discovered_at, last_verified_at, expires_at,
          status, duplicate_group_id, is_primary_duplicate,
          source_reliability, data_completeness, location_confidence,
          freshness_score, verification_score, overall_confidence,
          ai_classification, ai_classification_confidence,
          application_url, hash, created_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?, ?
        )
        ON CONFLICT(id) DO UPDATE SET
          source_id = excluded.source_id,
          source_job_id = excluded.source_job_id,
          source_url = excluded.source_url,
          canonical_url = excluded.canonical_url,
          title = excluded.title,
          normalized_title = excluded.normalized_title,
          company_name = excluded.company_name,
          company_id = excluded.company_id,
          company_verified = excluded.company_verified,
          description = excluded.description,
          short_description = excluded.short_description,
          employment_type = excluded.employment_type,
          work_mode = excluded.work_mode,
          experience_level = excluded.experience_level,
          salary_min = excluded.salary_min,
          salary_max = excluded.salary_max,
          salary_currency = excluded.salary_currency,
          salary_period = excluded.salary_period,
          salary_verified = excluded.salary_verified,
          location_text = excluded.location_text,
          city = excluded.city,
          state = excluded.state,
          country = excluded.country,
          postal_code = excluded.postal_code,
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          geocoding_accuracy = excluded.geocoding_accuracy,
          remote = excluded.remote,
          hybrid = excluded.hybrid,
          onsite = excluded.onsite,
          category = excluded.category,
          subcategory = excluded.subcategory,
          skills = excluded.skills,
          education_requirements = excluded.education_requirements,
          experience_requirements = excluded.experience_requirements,
          posted_at = excluded.posted_at,
          updated_at = excluded.updated_at,
          application_deadline = excluded.application_deadline,
          discovered_at = excluded.discovered_at,
          last_verified_at = excluded.last_verified_at,
          expires_at = excluded.expires_at,
          status = excluded.status,
          duplicate_group_id = excluded.duplicate_group_id,
          is_primary_duplicate = excluded.is_primary_duplicate,
          source_reliability = excluded.source_reliability,
          data_completeness = excluded.data_completeness,
          location_confidence = excluded.location_confidence,
          freshness_score = excluded.freshness_score,
          verification_score = excluded.verification_score,
          overall_confidence = excluded.overall_confidence,
          ai_classification = excluded.ai_classification,
          ai_classification_confidence = excluded.ai_classification_confidence,
          application_url = excluded.application_url,
          hash = excluded.hash;
      `,
      args: [
        job.id, job.source_id, job.source_job_id, job.source_url, job.canonical_url,
        job.title, job.normalized_title, job.company_name, job.company_id, job.company_verified ? 1 : 0,
        job.description, job.short_description, job.employment_type, job.work_mode, job.experience_level,
        job.salary_min, job.salary_max, job.salary_currency, job.salary_period, job.salary_verified ? 1 : 0,
        job.location_text, job.city, job.state, job.country, job.postal_code,
        job.latitude, job.longitude, job.geocoding_accuracy,
        job.remote ? 1 : 0, job.hybrid ? 1 : 0, job.onsite ? 1 : 0, job.category, job.subcategory,
        JSON.stringify(job.skills || []), JSON.stringify(job.education_requirements || []), JSON.stringify(job.experience_requirements || []),
        job.posted_at, job.updated_at, job.application_deadline,
        job.discovered_at, job.last_verified_at, job.expires_at,
        job.status, job.duplicate_group_id, job.is_primary_duplicate ? 1 : 0,
        job.source_reliability, job.data_completeness, job.location_confidence,
        job.freshness_score, job.verification_score, job.overall_confidence,
        JSON.stringify(job.ai_classification || {}), job.ai_classification_confidence,
        job.application_url, job.hash, job.created_at
      ]
    });

    if (auditLog) {
      await this.saveAuditLog(auditLog);
    }
  }

  async getJob(id: string): Promise<Job | null> {
    const res = await this.client.execute({
      sql: `SELECT * FROM jobs WHERE id = ?`,
      args: [id]
    });
    if (res.rows.length === 0) return null;
    return this.mapJobRow(res.rows[0]);
  }

  async getJobWithDuplicates(id: string): Promise<{ job: Job; duplicates: Job[] } | null> {
    const job = await this.getJob(id);
    if (!job) return null;

    const res = await this.client.execute({
      sql: `SELECT * FROM jobs WHERE duplicate_group_id = ? AND id != ?`,
      args: [job.duplicate_group_id, job.id]
    });

    return {
      job,
      duplicates: res.rows.map(r => this.mapJobRow(r))
    };
  }

  async findDuplicateCandidates(companyId: string, normalizedTitle: string, locationKey: string): Promise<Job[]> {
    const res = await this.client.execute({
      sql: `
        SELECT * FROM jobs 
        WHERE company_id = ? 
          AND (normalized_title = ? OR title = ?)
          AND (city = ? OR (remote = 1 AND ? = 'remote'))
      `,
      args: [companyId, normalizedTitle, normalizedTitle, locationKey, locationKey]
    });
    return res.rows.map(r => this.mapJobRow(r));
  }

  // ============================================================================
  // GEOSPATIAL NEARBY QUERY
  // ============================================================================

  async findNearbyJobs(filter: JobFilter): Promise<NearbyJobsResult> {
    const conditions: string[] = ["status = 'ACTIVE'", "is_primary_duplicate = 1"];
    const args: any[] = [];

    const hasCenter = filter.lat !== undefined && filter.lng !== undefined;
    const radiusKm = filter.radius_km || 50;

    let distanceSelect = "NULL as distance_km";

    if (hasCenter) {
      const lat = filter.lat!;
      const lng = filter.lng!;

      // 1. Bounding box pre-filter for indexed query performance
      const deltaLat = radiusKm / 111.32;
      const radLat = (lat * Math.PI) / 180;
      const deltaLng = radiusKm / (111.32 * Math.max(Math.cos(radLat), 0.01));

      const minLat = lat - deltaLat;
      const maxLat = lat + deltaLat;
      const minLng = lng - deltaLng;
      const maxLng = lng + deltaLng;

      // Distance calculation in SQL via Haversine
      distanceSelect = `
        (6371.0 * acos(
          min(1.0, max(-1.0,
            cos(? * 0.017453292519943295) * cos(latitude * 0.017453292519943295) *
            cos((longitude - ?) * 0.017453292519943295) +
            sin(? * 0.017453292519943295) * sin(latitude * 0.017453292519943295)
          ))
        )) AS distance_km
      `;

      if (filter.remote_only) {
        conditions.push("remote = 1");
      } else {
        // Include physical jobs in bounding box OR remote jobs
        conditions.push(`
          ((latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?) OR remote = 1)
        `);
        args.push(minLat, maxLat, minLng, maxLng);
      }
    } else if (filter.viewport) {
      conditions.push(`latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?`);
      args.push(
        filter.viewport.min_lat,
        filter.viewport.max_lat,
        filter.viewport.min_lng,
        filter.viewport.max_lng
      );
    } else if (filter.remote_only) {
      conditions.push("remote = 1");
    }

    // Work Mode Filter
    if (filter.work_mode && filter.work_mode.length > 0) {
      const placeholders = filter.work_mode.map(() => "?").join(", ");
      conditions.push(`work_mode IN (${placeholders})`);
      args.push(...filter.work_mode);
    }

    // Employment Type Filter
    if (filter.employment_type && filter.employment_type.length > 0) {
      const placeholders = filter.employment_type.map(() => "?").join(", ");
      conditions.push(`employment_type IN (${placeholders})`);
      args.push(...filter.employment_type);
    }

    // Experience Level Filter
    if (filter.experience_level && filter.experience_level.length > 0) {
      const placeholders = filter.experience_level.map(() => "?").join(", ");
      conditions.push(`experience_level IN (${placeholders})`);
      args.push(...filter.experience_level);
    }

    // Category Filter
    if (filter.category) {
      conditions.push(`category = ?`);
      args.push(filter.category);
    }

    // Salary Filters
    if (filter.salary_min !== undefined) {
      conditions.push(`(salary_max >= ? OR salary_min >= ?)`);
      args.push(filter.salary_min, filter.salary_min);
    }
    if (filter.salary_currency) {
      conditions.push(`salary_currency = ?`);
      args.push(filter.salary_currency);
    }

    // Freshness Days Filter
    if (filter.freshness_days !== undefined) {
      const cutoff = new Date(Date.now() - filter.freshness_days * 24 * 60 * 60 * 1000).toISOString();
      conditions.push(`(last_verified_at >= ? OR posted_at >= ?)`);
      args.push(cutoff, cutoff);
    }

    // Text query/keywords search
    if (filter.query) {
      const q = `%${filter.query.toLowerCase()}%`;
      conditions.push(`(
        LOWER(title) LIKE ? OR 
        LOWER(company_name) LIKE ? OR 
        LOWER(skills) LIKE ? OR 
        LOWER(description) LIKE ? OR
        LOWER(city) LIKE ?
      )`);
      args.push(q, q, q, q, q);
    }

    // Build Order By
    let orderBy = "overall_confidence DESC, discovered_at DESC";
    if (hasCenter) {
      if (filter.sort_by === "distance") {
        orderBy = "distance_km ASC, overall_confidence DESC";
      } else if (filter.sort_by === "freshness") {
        orderBy = "last_verified_at DESC, distance_km ASC";
      } else if (filter.sort_by === "salary") {
        orderBy = "salary_max DESC NULLS LAST, distance_km ASC";
      } else {
        // Relevance ranking
        orderBy = `
          (0.35 * overall_confidence + 
           0.35 * (1.0 / (1.0 + COALESCE(distance_km, 50.0) / 10.0)) + 
           0.30 * freshness_score) DESC
        `;
      }
    }

    const whereClause = conditions.join(" AND ");

    // Query Total Count
    const countSql = `SELECT COUNT(*) as cnt FROM jobs WHERE ${whereClause}`;
    const countRes = await this.client.execute({ sql: countSql, args });
    const total = Number(countRes.rows[0].cnt);

    // Query Records with Distance
    const selectArgs = hasCenter ? [filter.lat!, filter.lng!, filter.lat!, ...args] : args;
    const limit = filter.limit || 50;
    const offset = filter.offset || 0;

    const sql = `
      SELECT *, ${distanceSelect}
      FROM jobs
      WHERE ${whereClause}
      ${hasCenter && !filter.remote_only ? `HAVING (distance_km <= ${radiusKm} OR remote = 1)` : ""}
      ORDER BY ${orderBy}
      LIMIT ${limit} OFFSET ${offset}
    `;

    const res = await this.client.execute({ sql, args: selectArgs });
    const jobs = res.rows.map(r => this.mapJobRow(r));

    // Coverage statistics
    const sourcesRes = await this.client.execute(`
      SELECT COUNT(DISTINCT source_id) as sources_count, MAX(last_verified_at) as latest_verification 
      FROM jobs WHERE ${whereClause}
    `);
    const sRow = sourcesRes.rows[0] || {};

    return {
      jobs,
      total,
      coverage: {
        sources_count: Number(sRow.sources_count || 0),
        radius_km: hasCenter ? radiusKm : null,
        center: hasCenter ? { lat: filter.lat!, lng: filter.lng! } : null,
        latest_verification: sRow.latest_verification ? String(sRow.latest_verification) : null
      }
    };
  }

  async searchJobs(filter: JobFilter): Promise<NearbyJobsResult> {
    return this.findNearbyJobs(filter);
  }

  async updateJobStatus(id: string, status: JobStatus, details?: Record<string, any>): Promise<void> {
    const now = new Date().toISOString();
    await this.client.execute({
      sql: `UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?`,
      args: [status, now, id]
    });

    if (details) {
      await this.saveAuditLog({
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        job_id: id,
        stage: "STATUS_CHANGE",
        actor: details.actor || "system",
        details: { new_status: status, ...details },
        created_at: now
      });
    }
  }

  async getActiveJobsForVerification(limit: number = 50): Promise<Job[]> {
    const res = await this.client.execute({
      sql: `
        SELECT * FROM jobs 
        WHERE status = 'ACTIVE' 
        ORDER BY last_verified_at ASC 
        LIMIT ?
      `,
      args: [limit]
    });
    return res.rows.map(r => this.mapJobRow(r));
  }

  // ============================================================================
  // AUDIT LOGS
  // ============================================================================

  async saveAuditLog(log: JobAuditLog): Promise<void> {
    await this.client.execute({
      sql: `
        INSERT INTO job_audit_logs (id, job_id, stage, actor, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?);
      `,
      args: [log.id, log.job_id, log.stage, log.actor, JSON.stringify(log.details || {}), log.created_at]
    });
  }

  async getAuditLogs(jobId: string): Promise<JobAuditLog[]> {
    const res = await this.client.execute({
      sql: `SELECT * FROM job_audit_logs WHERE job_id = ? ORDER BY created_at ASC`,
      args: [jobId]
    });
    return res.rows.map(r => ({
      id: String(r.id),
      job_id: String(r.job_id),
      stage: String(r.stage),
      actor: String(r.actor),
      details: typeof r.details === "string" ? JSON.parse(r.details) : r.details,
      created_at: String(r.created_at)
    }));
  }

  // ============================================================================
  // REPORTS
  // ============================================================================

  async saveReport(report: JobReport): Promise<void> {
    await this.client.execute({
      sql: `
        INSERT INTO job_reports (id, job_id, reason, details, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?);
      `,
      args: [report.id, report.job_id, report.reason, report.details, report.status, report.created_at]
    });
  }

  async getAllReports(): Promise<JobReport[]> {
    const res = await this.client.execute(`SELECT * FROM job_reports ORDER BY created_at DESC`);
    return res.rows.map(r => ({
      id: String(r.id),
      job_id: String(r.job_id),
      reason: r.reason as any,
      details: String(r.details),
      status: r.status as any,
      created_at: String(r.created_at)
    }));
  }

  async updateReportStatus(id: string, status: JobReport["status"]): Promise<void> {
    await this.client.execute({
      sql: `UPDATE job_reports SET status = ? WHERE id = ?`,
      args: [status, id]
    });
  }

  // ============================================================================
  // HEALTH & METRICS
  // ============================================================================

  async getSystemHealth(): Promise<{
    status: string;
    totalJobs: number;
    activeJobs: number;
    staleJobs: number;
    expiredJobs: number;
    sourcesCount: number;
    dbType: string;
    dbLatencyMs: number;
  }> {
    const start = Date.now();
    const statsRes = await this.client.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'STALE' THEN 1 ELSE 0 END) as stale,
        SUM(CASE WHEN status = 'EXPIRED' THEN 1 ELSE 0 END) as expired
      FROM jobs;
    `);

    const sourcesRes = await this.client.execute(`SELECT COUNT(*) as cnt FROM sources WHERE is_active = 1;`);
    const latency = Date.now() - start;

    const row = statsRes.rows[0] || {};
    return {
      status: "healthy",
      totalJobs: Number(row.total || 0),
      activeJobs: Number(row.active || 0),
      staleJobs: Number(row.stale || 0),
      expiredJobs: Number(row.expired || 0),
      sourcesCount: Number(sourcesRes.rows[0]?.cnt || 0),
      dbType: "sqlite",
      dbLatencyMs: latency
    };
  }

  // ============================================================================
  // ROW MAPPERS
  // ============================================================================

  private mapJobRow(r: any): Job {
    return {
      id: String(r.id),
      source_id: String(r.source_id),
      source_job_id: String(r.source_job_id),
      source_url: String(r.source_url),
      canonical_url: String(r.canonical_url),
      title: String(r.title),
      normalized_title: String(r.normalized_title),
      company_name: String(r.company_name),
      company_id: String(r.company_id),
      company_verified: Boolean(r.company_verified),
      description: String(r.description),
      short_description: String(r.short_description || ""),
      employment_type: r.employment_type as any,
      work_mode: r.work_mode as any,
      experience_level: r.experience_level as any,
      salary_min: r.salary_min !== null ? Number(r.salary_min) : null,
      salary_max: r.salary_max !== null ? Number(r.salary_max) : null,
      salary_currency: r.salary_currency ? String(r.salary_currency) : null,
      salary_period: r.salary_period ? (r.salary_period as any) : null,
      salary_verified: Boolean(r.salary_verified),
      location_text: String(r.location_text),
      city: r.city ? String(r.city) : null,
      state: r.state ? String(r.state) : null,
      country: r.country ? String(r.country) : null,
      postal_code: r.postal_code ? String(r.postal_code) : null,
      latitude: r.latitude !== null ? Number(r.latitude) : null,
      longitude: r.longitude !== null ? Number(r.longitude) : null,
      geocoding_accuracy: r.geocoding_accuracy as any,
      remote: Boolean(r.remote),
      hybrid: Boolean(r.hybrid),
      onsite: Boolean(r.onsite),
      category: String(r.category),
      subcategory: String(r.subcategory),
      skills: typeof r.skills === "string" ? JSON.parse(r.skills || "[]") : (r.skills || []),
      education_requirements: typeof r.education_requirements === "string" ? JSON.parse(r.education_requirements || "[]") : (r.education_requirements || []),
      experience_requirements: typeof r.experience_requirements === "string" ? JSON.parse(r.experience_requirements || "[]") : (r.experience_requirements || []),
      posted_at: r.posted_at ? String(r.posted_at) : null,
      updated_at: String(r.updated_at),
      application_deadline: r.application_deadline ? String(r.application_deadline) : null,
      discovered_at: String(r.discovered_at),
      last_verified_at: String(r.last_verified_at),
      expires_at: r.expires_at ? String(r.expires_at) : null,
      status: r.status as any,
      duplicate_group_id: String(r.duplicate_group_id),
      is_primary_duplicate: Boolean(r.is_primary_duplicate),
      source_reliability: Number(r.source_reliability),
      data_completeness: Number(r.data_completeness),
      location_confidence: Number(r.location_confidence),
      freshness_score: Number(r.freshness_score),
      verification_score: Number(r.verification_score),
      overall_confidence: Number(r.overall_confidence),
      ai_classification: typeof r.ai_classification === "string" ? JSON.parse(r.ai_classification || "{}") : (r.ai_classification || {}),
      ai_classification_confidence: Number(r.ai_classification_confidence),
      application_url: String(r.application_url),
      hash: String(r.hash),
      created_at: String(r.created_at),
      distance_km: r.distance_km !== undefined && r.distance_km !== null ? Number(Number(r.distance_km).toFixed(2)) : undefined
    };
  }

  private mapSourceRow(r: any): Source {
    return {
      id: String(r.id),
      name: String(r.name),
      source_type: r.source_type as any,
      source_url: String(r.source_url),
      retrieval_method: r.retrieval_method as any,
      last_successful_retrieval: r.last_successful_retrieval ? String(r.last_successful_retrieval) : null,
      last_attempted_retrieval: r.last_attempted_retrieval ? String(r.last_attempted_retrieval) : null,
      http_status: r.http_status !== null ? Number(r.http_status) : null,
      parsing_status: r.parsing_status as any,
      jobs_discovered: Number(r.jobs_discovered),
      jobs_accepted: Number(r.jobs_accepted),
      jobs_rejected: Number(r.jobs_rejected),
      jobs_duplicated: Number(r.jobs_duplicated),
      error_logs: typeof r.error_logs === "string" ? JSON.parse(r.error_logs || "[]") : (r.error_logs || []),
      rate_limit_status: typeof r.rate_limit_status === "string" ? JSON.parse(r.rate_limit_status || "{}") : (r.rate_limit_status || {}),
      data_freshness: r.data_freshness ? String(r.data_freshness) : null,
      reliability_score: Number(r.reliability_score),
      is_active: Boolean(r.is_active)
    };
  }

  private mapCompanyRow(r: any): Company {
    return {
      id: String(r.id),
      canonical_name: String(r.canonical_name),
      aliases: typeof r.aliases === "string" ? JSON.parse(r.aliases || "[]") : (r.aliases || []),
      website: r.website ? String(r.website) : null,
      industry: r.industry ? String(r.industry) : null,
      verified: Boolean(r.verified),
      source_count: Number(r.source_count),
      created_at: String(r.created_at),
      updated_at: String(r.updated_at)
    };
  }
}
