import { Pool } from "pg";
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

export class PostgresDatabaseProvider implements DatabaseProvider {
  name = "postgres";
  private pool: Pool;

  constructor(connectionString: string = process.env.DATABASE_URL || "") {
    this.pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }

  async init(): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Enable PostGIS extension if available
      await client.query("CREATE EXTENSION IF NOT EXISTS postgis;");

      // 1. Sources
      await client.query(`
        CREATE TABLE IF NOT EXISTS sources (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          source_type TEXT NOT NULL,
          source_url TEXT NOT NULL,
          retrieval_method TEXT NOT NULL,
          last_successful_retrieval TIMESTAMPTZ,
          last_attempted_retrieval TIMESTAMPTZ,
          http_status INTEGER,
          parsing_status TEXT NOT NULL,
          jobs_discovered INTEGER DEFAULT 0,
          jobs_accepted INTEGER DEFAULT 0,
          jobs_rejected INTEGER DEFAULT 0,
          jobs_duplicated INTEGER DEFAULT 0,
          error_logs JSONB DEFAULT '[]'::jsonb,
          rate_limit_status JSONB DEFAULT '{}'::jsonb,
          data_freshness TIMESTAMPTZ,
          reliability_score DOUBLE PRECISION NOT NULL,
          is_active BOOLEAN DEFAULT TRUE
        );
      `);

      // 2. Raw Source Records
      await client.query(`
        CREATE TABLE IF NOT EXISTS raw_source_records (
          id TEXT PRIMARY KEY,
          source_id TEXT NOT NULL REFERENCES sources(id),
          external_job_id TEXT NOT NULL,
          raw_payload TEXT NOT NULL,
          raw_url TEXT NOT NULL,
          ingested_at TIMESTAMPTZ NOT NULL,
          checksum TEXT NOT NULL
        );
      `);

      // 3. Companies
      await client.query(`
        CREATE TABLE IF NOT EXISTS companies (
          id TEXT PRIMARY KEY,
          canonical_name TEXT UNIQUE NOT NULL,
          aliases JSONB DEFAULT '[]'::jsonb,
          website TEXT,
          industry TEXT,
          verified BOOLEAN DEFAULT FALSE,
          source_count INTEGER DEFAULT 1,
          created_at TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL
        );
      `);

      // 4. Jobs
      await client.query(`
        CREATE TABLE IF NOT EXISTS jobs (
          id TEXT PRIMARY KEY,
          source_id TEXT NOT NULL REFERENCES sources(id),
          source_job_id TEXT NOT NULL,
          source_url TEXT NOT NULL,
          canonical_url TEXT NOT NULL,

          title TEXT NOT NULL,
          normalized_title TEXT NOT NULL,

          company_name TEXT NOT NULL,
          company_id TEXT NOT NULL REFERENCES companies(id),
          company_verified BOOLEAN DEFAULT FALSE,

          description TEXT NOT NULL,
          short_description TEXT DEFAULT '',

          employment_type TEXT NOT NULL,
          work_mode TEXT NOT NULL,
          experience_level TEXT NOT NULL,

          salary_min DOUBLE PRECISION,
          salary_max DOUBLE PRECISION,
          salary_currency TEXT,
          salary_period TEXT,
          salary_verified BOOLEAN DEFAULT FALSE,

          location_text TEXT NOT NULL,
          city TEXT,
          state TEXT,
          country TEXT,
          postal_code TEXT,

          latitude DOUBLE PRECISION,
          longitude DOUBLE PRECISION,
          geocoding_accuracy TEXT NOT NULL,

          remote BOOLEAN DEFAULT FALSE,
          hybrid BOOLEAN DEFAULT FALSE,
          onsite BOOLEAN DEFAULT FALSE,

          category TEXT NOT NULL,
          subcategory TEXT NOT NULL,
          skills JSONB DEFAULT '[]'::jsonb,
          education_requirements JSONB DEFAULT '[]'::jsonb,
          experience_requirements JSONB DEFAULT '[]'::jsonb,

          posted_at TIMESTAMPTZ,
          updated_at TIMESTAMPTZ NOT NULL,
          application_deadline TIMESTAMPTZ,

          discovered_at TIMESTAMPTZ NOT NULL,
          last_verified_at TIMESTAMPTZ NOT NULL,
          expires_at TIMESTAMPTZ,

          status TEXT NOT NULL,
          duplicate_group_id TEXT NOT NULL,
          is_primary_duplicate BOOLEAN DEFAULT TRUE,

          source_reliability DOUBLE PRECISION NOT NULL,
          data_completeness DOUBLE PRECISION NOT NULL,
          location_confidence DOUBLE PRECISION NOT NULL,
          freshness_score DOUBLE PRECISION NOT NULL,
          verification_score DOUBLE PRECISION NOT NULL,
          overall_confidence DOUBLE PRECISION NOT NULL,

          ai_classification JSONB DEFAULT '{}'::jsonb,
          ai_classification_confidence DOUBLE PRECISION DEFAULT 0.0,

          application_url TEXT NOT NULL,
          hash TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL
        );
      `);

      // Spatial PostGIS column / index
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='jobs' AND column_name='geom'
          ) THEN
            ALTER TABLE jobs ADD COLUMN geom geography(Point, 4326);
          END IF;
        END $$;
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_jobs_postgis ON jobs USING GIST(geom) WHERE status = 'ACTIVE' AND geom IS NOT NULL;`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_pg_jobs_hash ON jobs(hash);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_pg_jobs_status ON jobs(status);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_pg_jobs_company_id ON jobs(company_id);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_pg_jobs_duplicate_group ON jobs(duplicate_group_id);`);

      // 5. Job Audit Logs
      await client.query(`
        CREATE TABLE IF NOT EXISTS job_audit_logs (
          id TEXT PRIMARY KEY,
          job_id TEXT NOT NULL,
          stage TEXT NOT NULL,
          actor TEXT NOT NULL,
          details JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL
        );
      `);

      // 6. Job Reports
      await client.query(`
        CREATE TABLE IF NOT EXISTS job_reports (
          id TEXT PRIMARY KEY,
          job_id TEXT NOT NULL,
          reason TEXT NOT NULL,
          details TEXT NOT NULL,
          status TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL
        );
      `);
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  // ============================================================================
  // SOURCES
  // ============================================================================

  async upsertSource(source: Source): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO sources (
        id, name, source_type, source_url, retrieval_method,
        last_successful_retrieval, last_attempted_retrieval, http_status,
        parsing_status, jobs_discovered, jobs_accepted, jobs_rejected,
        jobs_duplicated, error_logs, rate_limit_status, data_freshness,
        reliability_score, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      ON CONFLICT(id) DO UPDATE SET
        name = EXCLUDED.name,
        source_type = EXCLUDED.source_type,
        source_url = EXCLUDED.source_url,
        retrieval_method = EXCLUDED.retrieval_method,
        last_successful_retrieval = COALESCE(EXCLUDED.last_successful_retrieval, sources.last_successful_retrieval),
        last_attempted_retrieval = EXCLUDED.last_attempted_retrieval,
        http_status = EXCLUDED.http_status,
        parsing_status = EXCLUDED.parsing_status,
        jobs_discovered = EXCLUDED.jobs_discovered,
        jobs_accepted = EXCLUDED.jobs_accepted,
        jobs_rejected = EXCLUDED.jobs_rejected,
        jobs_duplicated = EXCLUDED.jobs_duplicated,
        error_logs = EXCLUDED.error_logs,
        rate_limit_status = EXCLUDED.rate_limit_status,
        data_freshness = EXCLUDED.data_freshness,
        reliability_score = EXCLUDED.reliability_score,
        is_active = EXCLUDED.is_active;
    `,
      [
        source.id, source.name, source.source_type, source.source_url, source.retrieval_method,
        source.last_successful_retrieval, source.last_attempted_retrieval, source.http_status,
        source.parsing_status, source.jobs_discovered, source.jobs_accepted, source.jobs_rejected,
        source.jobs_duplicated, JSON.stringify(source.error_logs || []), JSON.stringify(source.rate_limit_status || {}),
        source.data_freshness, source.reliability_score, source.is_active
      ]
    );
  }

  async getSource(id: string): Promise<Source | null> {
    const res = await this.pool.query(`SELECT * FROM sources WHERE id = $1`, [id]);
    if (res.rows.length === 0) return null;
    return this.mapSourceRow(res.rows[0]);
  }

  async getAllSources(): Promise<Source[]> {
    const res = await this.pool.query(`SELECT * FROM sources ORDER BY reliability_score DESC, name ASC`);
    return res.rows.map(r => this.mapSourceRow(r));
  }

  async updateSourceStats(id: string, stats: Partial<Source>): Promise<void> {
    const sets: string[] = [];
    const args: any[] = [];
    let idx = 1;
    for (const [key, value] of Object.entries(stats)) {
      sets.push(`${key} = $${idx++}`);
      args.push(typeof value === "object" ? JSON.stringify(value) : value);
    }
    if (sets.length === 0) return;
    args.push(id);
    await this.pool.query(`UPDATE sources SET ${sets.join(", ")} WHERE id = $${idx}`, args);
  }

  // ============================================================================
  // RAW SOURCE RECORDS
  // ============================================================================

  async saveRawRecord(record: RawSourceRecord): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO raw_source_records (
        id, source_id, external_job_id, raw_payload, raw_url, ingested_at, checksum
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT(id) DO NOTHING;
    `,
      [
        record.id, record.source_id, record.external_job_id,
        record.raw_payload, record.raw_url, record.ingested_at, record.checksum
      ]
    );
  }

  async getRawRecord(id: string): Promise<RawSourceRecord | null> {
    const res = await this.pool.query(`SELECT * FROM raw_source_records WHERE id = $1`, [id]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: String(r.id),
      source_id: String(r.source_id),
      external_job_id: String(r.external_job_id),
      raw_payload: String(r.raw_payload),
      raw_url: String(r.raw_url),
      ingested_at: new Date(r.ingested_at).toISOString(),
      checksum: String(r.checksum)
    };
  }

  // ============================================================================
  // COMPANIES
  // ============================================================================

  async upsertCompany(company: Company): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO companies (
        id, canonical_name, aliases, website, industry, verified, source_count, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT(id) DO UPDATE SET
        canonical_name = EXCLUDED.canonical_name,
        aliases = EXCLUDED.aliases,
        website = COALESCE(EXCLUDED.website, companies.website),
        industry = COALESCE(EXCLUDED.industry, companies.industry),
        verified = EXCLUDED.verified,
        source_count = EXCLUDED.source_count,
        updated_at = EXCLUDED.updated_at;
    `,
      [
        company.id, company.canonical_name, JSON.stringify(company.aliases || []),
        company.website, company.industry, company.verified, company.source_count,
        company.created_at, company.updated_at
      ]
    );
  }

  async findCompanyByAlias(name: string): Promise<Company | null> {
    const normalized = name.trim().toLowerCase();
    const res = await this.pool.query(
      `SELECT * FROM companies WHERE LOWER(canonical_name) = $1 OR aliases @> $2::jsonb LIMIT 1`,
      [normalized, JSON.stringify([normalized])]
    );
    if (res.rows.length === 0) return null;
    return this.mapCompanyRow(res.rows[0]);
  }

  async getCompany(id: string): Promise<Company | null> {
    const res = await this.pool.query(`SELECT * FROM companies WHERE id = $1`, [id]);
    if (res.rows.length === 0) return null;
    return this.mapCompanyRow(res.rows[0]);
  }

  // ============================================================================
  // JOBS
  // ============================================================================

  async upsertJob(job: Job, auditLog?: JobAuditLog): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO jobs (
        id, source_id, source_job_id, source_url, canonical_url,
        title, normalized_title, company_name, company_id, company_verified,
        description, short_description, employment_type, work_mode, experience_level,
        salary_min, salary_max, salary_currency, salary_period, salary_verified,
        location_text, city, state, country, postal_code,
        latitude, longitude, geocoding_accuracy, geom,
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
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25,
        $26, $27, $28, CASE WHEN $26::double precision IS NOT NULL AND $27::double precision IS NOT NULL THEN ST_SetSRID(ST_MakePoint($27, $26), 4326)::geography ELSE NULL END,
        $29, $30, $31, $32, $33,
        $34, $35, $36,
        $37, $38, $39,
        $40, $41, $42,
        $43, $44, $45,
        $46, $47, $48,
        $49, $50, $51,
        $52, $53,
        $54, $55, $56
      )
      ON CONFLICT(id) DO UPDATE SET
        source_id = EXCLUDED.source_id,
        source_job_id = EXCLUDED.source_job_id,
        source_url = EXCLUDED.source_url,
        canonical_url = EXCLUDED.canonical_url,
        title = EXCLUDED.title,
        normalized_title = EXCLUDED.normalized_title,
        company_name = EXCLUDED.company_name,
        company_id = EXCLUDED.company_id,
        company_verified = EXCLUDED.company_verified,
        description = EXCLUDED.description,
        short_description = EXCLUDED.short_description,
        employment_type = EXCLUDED.employment_type,
        work_mode = EXCLUDED.work_mode,
        experience_level = EXCLUDED.experience_level,
        salary_min = EXCLUDED.salary_min,
        salary_max = EXCLUDED.salary_max,
        salary_currency = EXCLUDED.salary_currency,
        salary_period = EXCLUDED.salary_period,
        salary_verified = EXCLUDED.salary_verified,
        location_text = EXCLUDED.location_text,
        city = EXCLUDED.city,
        state = EXCLUDED.state,
        country = EXCLUDED.country,
        postal_code = EXCLUDED.postal_code,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        geocoding_accuracy = EXCLUDED.geocoding_accuracy,
        geom = EXCLUDED.geom,
        remote = EXCLUDED.remote,
        hybrid = EXCLUDED.hybrid,
        onsite = EXCLUDED.onsite,
        category = EXCLUDED.category,
        subcategory = EXCLUDED.subcategory,
        skills = EXCLUDED.skills,
        education_requirements = EXCLUDED.education_requirements,
        experience_requirements = EXCLUDED.experience_requirements,
        posted_at = EXCLUDED.posted_at,
        updated_at = EXCLUDED.updated_at,
        application_deadline = EXCLUDED.application_deadline,
        discovered_at = EXCLUDED.discovered_at,
        last_verified_at = EXCLUDED.last_verified_at,
        expires_at = EXCLUDED.expires_at,
        status = EXCLUDED.status,
        duplicate_group_id = EXCLUDED.duplicate_group_id,
        is_primary_duplicate = EXCLUDED.is_primary_duplicate,
        source_reliability = EXCLUDED.source_reliability,
        data_completeness = EXCLUDED.data_completeness,
        location_confidence = EXCLUDED.location_confidence,
        freshness_score = EXCLUDED.freshness_score,
        verification_score = EXCLUDED.verification_score,
        overall_confidence = EXCLUDED.overall_confidence,
        ai_classification = EXCLUDED.ai_classification,
        ai_classification_confidence = EXCLUDED.ai_classification_confidence,
        application_url = EXCLUDED.application_url,
        hash = EXCLUDED.hash;
    `,
      [
        job.id, job.source_id, job.source_job_id, job.source_url, job.canonical_url,
        job.title, job.normalized_title, job.company_name, job.company_id, job.company_verified,
        job.description, job.short_description, job.employment_type, job.work_mode, job.experience_level,
        job.salary_min, job.salary_max, job.salary_currency, job.salary_period, job.salary_verified,
        job.location_text, job.city, job.state, job.country, job.postal_code,
        job.latitude, job.longitude, job.geocoding_accuracy,
        job.remote, job.hybrid, job.onsite, job.category, job.subcategory,
        JSON.stringify(job.skills || []), JSON.stringify(job.education_requirements || []), JSON.stringify(job.experience_requirements || []),
        job.posted_at, job.updated_at, job.application_deadline,
        job.discovered_at, job.last_verified_at, job.expires_at,
        job.status, job.duplicate_group_id, job.is_primary_duplicate,
        job.source_reliability, job.data_completeness, job.location_confidence,
        job.freshness_score, job.verification_score, job.overall_confidence,
        JSON.stringify(job.ai_classification || {}), job.ai_classification_confidence,
        job.application_url, job.hash, job.created_at
      ]
    );

    if (auditLog) {
      await this.saveAuditLog(auditLog);
    }
  }

  async getJob(id: string): Promise<Job | null> {
    const res = await this.pool.query(`SELECT * FROM jobs WHERE id = $1`, [id]);
    if (res.rows.length === 0) return null;
    return this.mapJobRow(res.rows[0]);
  }

  async getJobWithDuplicates(id: string): Promise<{ job: Job; duplicates: Job[] } | null> {
    const job = await this.getJob(id);
    if (!job) return null;

    const res = await this.pool.query(
      `SELECT * FROM jobs WHERE duplicate_group_id = $1 AND id != $2`,
      [job.duplicate_group_id, job.id]
    );

    return {
      job,
      duplicates: res.rows.map(r => this.mapJobRow(r))
    };
  }

  async findDuplicateCandidates(companyId: string, normalizedTitle: string, locationKey: string): Promise<Job[]> {
    const res = await this.pool.query(
      `
      SELECT * FROM jobs 
      WHERE company_id = $1 
        AND (normalized_title = $2 OR title = $2)
        AND (city = $3 OR (remote = TRUE AND $3 = 'remote'))
    `,
      [companyId, normalizedTitle, locationKey]
    );
    return res.rows.map(r => this.mapJobRow(r));
  }

  async findNearbyJobs(filter: JobFilter): Promise<NearbyJobsResult> {
    const conditions: string[] = ["status = 'ACTIVE'", "is_primary_duplicate = TRUE"];
    const args: any[] = [];
    let idx = 1;

    const hasCenter = filter.lat !== undefined && filter.lng !== undefined;
    const radiusKm = filter.radius_km || 50;

    let distanceSelect = "NULL as distance_km";

    if (hasCenter) {
      const lat = filter.lat!;
      const lng = filter.lng!;

      distanceSelect = `
        ROUND((ST_Distance(geom, ST_SetSRID(ST_MakePoint($${idx}, $${idx + 1}), 4326)::geography) / 1000.0)::numeric, 2) AS distance_km
      `;
      args.push(lng, lat);
      idx += 2;

      if (filter.remote_only) {
        conditions.push("remote = TRUE");
      } else {
        conditions.push(`
          (ST_DWithin(geom, ST_SetSRID(ST_MakePoint($${idx - 2}, $${idx - 1}), 4326)::geography, $${idx} * 1000) OR remote = TRUE)
        `);
        args.push(radiusKm);
        idx++;
      }
    } else if (filter.viewport) {
      conditions.push(`latitude BETWEEN $${idx++} AND $${idx++} AND longitude BETWEEN $${idx++} AND $${idx++}`);
      args.push(
        filter.viewport.min_lat,
        filter.viewport.max_lat,
        filter.viewport.min_lng,
        filter.viewport.max_lng
      );
    } else if (filter.remote_only) {
      conditions.push("remote = TRUE");
    }

    if (filter.work_mode && filter.work_mode.length > 0) {
      conditions.push(`work_mode = ANY($${idx++})`);
      args.push(filter.work_mode);
    }

    if (filter.employment_type && filter.employment_type.length > 0) {
      conditions.push(`employment_type = ANY($${idx++})`);
      args.push(filter.employment_type);
    }

    if (filter.experience_level && filter.experience_level.length > 0) {
      conditions.push(`experience_level = ANY($${idx++})`);
      args.push(filter.experience_level);
    }

    if (filter.category) {
      conditions.push(`category = $${idx++}`);
      args.push(filter.category);
    }

    if (filter.salary_min !== undefined) {
      conditions.push(`(salary_max >= $${idx} OR salary_min >= $${idx})`);
      args.push(filter.salary_min);
      idx++;
    }

    if (filter.salary_currency) {
      conditions.push(`salary_currency = $${idx++}`);
      args.push(filter.salary_currency);
    }

    if (filter.query) {
      const q = `%${filter.query.toLowerCase()}%`;
      conditions.push(`(
        LOWER(title) LIKE $${idx} OR 
        LOWER(company_name) LIKE $${idx} OR 
        LOWER(skills::text) LIKE $${idx} OR 
        LOWER(description) LIKE $${idx} OR
        LOWER(city) LIKE $${idx}
      )`);
      args.push(q);
      idx++;
    }

    const whereClause = conditions.join(" AND ");

    const countRes = await this.pool.query(`SELECT COUNT(*) as cnt FROM jobs WHERE ${whereClause}`, args);
    const total = Number(countRes.rows[0].cnt);

    let orderBy = "overall_confidence DESC, discovered_at DESC";
    if (hasCenter) {
      if (filter.sort_by === "distance") {
        orderBy = "distance_km ASC NULLS LAST, overall_confidence DESC";
      } else if (filter.sort_by === "freshness") {
        orderBy = "last_verified_at DESC, distance_km ASC NULLS LAST";
      } else if (filter.sort_by === "salary") {
        orderBy = "salary_max DESC NULLS LAST, distance_km ASC NULLS LAST";
      } else {
        orderBy = `
          (0.35 * overall_confidence + 
           0.35 * (1.0 / (1.0 + COALESCE(distance_km, 50.0) / 10.0)) + 
           0.30 * freshness_score) DESC
        `;
      }
    }

    const limit = filter.limit || 50;
    const offset = filter.offset || 0;

    const sql = `
      SELECT *, ${distanceSelect}
      FROM jobs
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    args.push(limit, offset);

    const res = await this.pool.query(sql, args);
    const jobs = res.rows.map(r => this.mapJobRow(r));

    const sourcesRes = await this.pool.query(`
      SELECT COUNT(DISTINCT source_id) as sources_count, MAX(last_verified_at) as latest_verification 
      FROM jobs WHERE ${whereClause}
    `, args.slice(0, args.length - 2));
    const sRow = sourcesRes.rows[0] || {};

    return {
      jobs,
      total,
      coverage: {
        sources_count: Number(sRow.sources_count || 0),
        radius_km: hasCenter ? radiusKm : null,
        center: hasCenter ? { lat: filter.lat!, lng: filter.lng! } : null,
        latest_verification: sRow.latest_verification ? new Date(sRow.latest_verification).toISOString() : null
      }
    };
  }

  async searchJobs(filter: JobFilter): Promise<NearbyJobsResult> {
    return this.findNearbyJobs(filter);
  }

  async updateJobStatus(id: string, status: JobStatus, details?: Record<string, any>): Promise<void> {
    const now = new Date().toISOString();
    await this.pool.query(`UPDATE jobs SET status = $1, updated_at = $2 WHERE id = $3`, [status, now, id]);

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
    const res = await this.pool.query(
      `SELECT * FROM jobs WHERE status = 'ACTIVE' ORDER BY last_verified_at ASC LIMIT $1`,
      [limit]
    );
    return res.rows.map(r => this.mapJobRow(r));
  }

  // ============================================================================
  // AUDIT LOGS
  // ============================================================================

  async saveAuditLog(log: JobAuditLog): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO job_audit_logs (id, job_id, stage, actor, details, created_at)
      VALUES ($1, $2, $3, $4, $5, $6);
    `,
      [log.id, log.job_id, log.stage, log.actor, JSON.stringify(log.details || {}), log.created_at]
    );
  }

  async getAuditLogs(jobId: string): Promise<JobAuditLog[]> {
    const res = await this.pool.query(
      `SELECT * FROM job_audit_logs WHERE job_id = $1 ORDER BY created_at ASC`,
      [jobId]
    );
    return res.rows.map(r => ({
      id: String(r.id),
      job_id: String(r.job_id),
      stage: String(r.stage),
      actor: String(r.actor),
      details: typeof r.details === "string" ? JSON.parse(r.details) : r.details,
      created_at: new Date(r.created_at).toISOString()
    }));
  }

  // ============================================================================
  // REPORTS
  // ============================================================================

  async saveReport(report: JobReport): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO job_reports (id, job_id, reason, details, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6);
    `,
      [report.id, report.job_id, report.reason, report.details, report.status, report.created_at]
    );
  }

  async getAllReports(): Promise<JobReport[]> {
    const res = await this.pool.query(`SELECT * FROM job_reports ORDER BY created_at DESC`);
    return res.rows.map(r => ({
      id: String(r.id),
      job_id: String(r.job_id),
      reason: r.reason as any,
      details: String(r.details),
      status: r.status as any,
      created_at: new Date(r.created_at).toISOString()
    }));
  }

  async updateReportStatus(id: string, status: JobReport["status"]): Promise<void> {
    await this.pool.query(`UPDATE job_reports SET status = $1 WHERE id = $2`, [status, id]);
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
    const statsRes = await this.pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'STALE' THEN 1 ELSE 0 END) as stale,
        SUM(CASE WHEN status = 'EXPIRED' THEN 1 ELSE 0 END) as expired
      FROM jobs;
    `);

    const sourcesRes = await this.pool.query(`SELECT COUNT(*) as cnt FROM sources WHERE is_active = TRUE;`);
    const latency = Date.now() - start;

    const row = statsRes.rows[0] || {};
    return {
      status: "healthy",
      totalJobs: Number(row.total || 0),
      activeJobs: Number(row.active || 0),
      staleJobs: Number(row.stale || 0),
      expiredJobs: Number(row.expired || 0),
      sourcesCount: Number(sourcesRes.rows[0]?.cnt || 0),
      dbType: "postgres",
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
      skills: Array.isArray(r.skills) ? r.skills : (typeof r.skills === "string" ? JSON.parse(r.skills) : []),
      education_requirements: Array.isArray(r.education_requirements) ? r.education_requirements : [],
      experience_requirements: Array.isArray(r.experience_requirements) ? r.experience_requirements : [],
      posted_at: r.posted_at ? new Date(r.posted_at).toISOString() : null,
      updated_at: new Date(r.updated_at).toISOString(),
      application_deadline: r.application_deadline ? new Date(r.application_deadline).toISOString() : null,
      discovered_at: new Date(r.discovered_at).toISOString(),
      last_verified_at: new Date(r.last_verified_at).toISOString(),
      expires_at: r.expires_at ? new Date(r.expires_at).toISOString() : null,
      status: r.status as any,
      duplicate_group_id: String(r.duplicate_group_id),
      is_primary_duplicate: Boolean(r.is_primary_duplicate),
      source_reliability: Number(r.source_reliability),
      data_completeness: Number(r.data_completeness),
      location_confidence: Number(r.location_confidence),
      freshness_score: Number(r.freshness_score),
      verification_score: Number(r.verification_score),
      overall_confidence: Number(r.overall_confidence),
      ai_classification: typeof r.ai_classification === "object" ? r.ai_classification : {},
      ai_classification_confidence: Number(r.ai_classification_confidence),
      application_url: String(r.application_url),
      hash: String(r.hash),
      created_at: new Date(r.created_at).toISOString(),
      distance_km: r.distance_km !== undefined && r.distance_km !== null ? Number(r.distance_km) : undefined
    };
  }

  private mapSourceRow(r: any): Source {
    return {
      id: String(r.id),
      name: String(r.name),
      source_type: r.source_type as any,
      source_url: String(r.source_url),
      retrieval_method: r.retrieval_method as any,
      last_successful_retrieval: r.last_successful_retrieval ? new Date(r.last_successful_retrieval).toISOString() : null,
      last_attempted_retrieval: r.last_attempted_retrieval ? new Date(r.last_attempted_retrieval).toISOString() : null,
      http_status: r.http_status !== null ? Number(r.http_status) : null,
      parsing_status: r.parsing_status as any,
      jobs_discovered: Number(r.jobs_discovered),
      jobs_accepted: Number(r.jobs_accepted),
      jobs_rejected: Number(r.jobs_rejected),
      jobs_duplicated: Number(r.jobs_duplicated),
      error_logs: Array.isArray(r.error_logs) ? r.error_logs : [],
      rate_limit_status: typeof r.rate_limit_status === "object" ? r.rate_limit_status : {},
      data_freshness: r.data_freshness ? new Date(r.data_freshness).toISOString() : null,
      reliability_score: Number(r.reliability_score),
      is_active: Boolean(r.is_active)
    };
  }

  private mapCompanyRow(r: any): Company {
    return {
      id: String(r.id),
      canonical_name: String(r.canonical_name),
      aliases: Array.isArray(r.aliases) ? r.aliases : [],
      website: r.website ? String(r.website) : null,
      industry: r.industry ? String(r.industry) : null,
      verified: Boolean(r.verified),
      source_count: Number(r.source_count),
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString()
    };
  }
}
