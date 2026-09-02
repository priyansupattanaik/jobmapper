import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { UrlValidator } from "@/lib/pipeline/urlValidator";
import { FreshnessEngine } from "@/lib/pipeline/freshness";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const db = await getDb();
    const job = await db.getJob(id);

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const validator = new UrlValidator(8000);
    const urlCheck = await validator.validateUrl(job.application_url || job.source_url);
    const now = new Date().toISOString();

    if (urlCheck.isDeadPage) {
      await db.updateJobStatus(job.id, "EXPIRED", {
        actor: "admin:manual_reverify",
        reason: "Source link returned 404 or dead page",
        http_status: urlCheck.httpStatus
      });
      return NextResponse.json({
        success: true,
        message: "Job verified: Source page is dead. Marked EXPIRED.",
        status: "EXPIRED",
        urlCheck
      });
    }

    const freshness = FreshnessEngine.assessFreshness(now, job.posted_at, false);
    const overall = FreshnessEngine.calculateOverallConfidence({
      source_reliability: job.source_reliability,
      verification_score: urlCheck.isAccessible ? 1.0 : 0.5,
      freshness_score: freshness.score,
      location_confidence: job.location_confidence,
      data_completeness: job.data_completeness
    });

    job.last_verified_at = now;
    job.canonical_url = urlCheck.canonicalUrl;
    job.freshness_score = freshness.score;
    job.verification_score = urlCheck.isAccessible ? 1.0 : 0.5;
    job.overall_confidence = overall;
    job.status = freshness.status;

    await db.upsertJob(job, {
      id: `audit_adm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      job_id: job.id,
      stage: "MANUAL_REVERIFICATION",
      actor: "admin",
      details: { urlCheck, freshness },
      created_at: now
    });

    return NextResponse.json({
      success: true,
      message: "Job verified successfully: Active and reachable.",
      status: job.status,
      job,
      urlCheck
    });
  } catch (error) {
    console.error("Admin reverify error:", error);
    return NextResponse.json({ error: "Reverification failed" }, { status: 500 });
  }
}
