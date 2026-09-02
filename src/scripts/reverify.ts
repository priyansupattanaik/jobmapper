import { getDb } from "../lib/db";
import { UrlValidator } from "../lib/pipeline/urlValidator";
import { FreshnessEngine } from "../lib/pipeline/freshness";

async function main() {
  console.log("Starting background freshness & URL reverification worker...");
  const db = await getDb();
  const validator = new UrlValidator(5000);

  const jobsToVerify = await db.getActiveJobsForVerification(25);
  console.log(`Checking ${jobsToVerify.length} active jobs...`);

  let expiredCount = 0;
  let activeCount = 0;

  for (const job of jobsToVerify) {
    const urlCheck = await validator.validateUrl(job.application_url || job.source_url);
    const now = new Date().toISOString();

    if (urlCheck.isDeadPage) {
      console.log(`[EXPIRED] Job "${job.title}" at ${job.company_name} - Link returned ${urlCheck.httpStatus || "Dead"}`);
      await db.updateJobStatus(job.id, "EXPIRED", {
        actor: "worker:reverification",
        reason: "Source link is dead or returned 404/410",
        http_status: urlCheck.httpStatus
      });
      expiredCount++;
    } else {
      const freshness = FreshnessEngine.assessFreshness(now, job.posted_at, false);
      const overall = FreshnessEngine.calculateOverallConfidence({
        source_reliability: job.source_reliability,
        verification_score: urlCheck.isAccessible ? 1.0 : 0.5,
        freshness_score: freshness.score,
        location_confidence: job.location_confidence,
        data_completeness: job.data_completeness
      });

      job.last_verified_at = now;
      job.freshness_score = freshness.score;
      job.overall_confidence = overall;
      job.status = freshness.status;

      await db.upsertJob(job, {
        id: `audit_rev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        job_id: job.id,
        stage: "REVERIFICATION",
        actor: "worker:reverification",
        details: { url_status: urlCheck.httpStatus, freshness_label: freshness.label },
        created_at: now
      });
      activeCount++;
    }
  }

  console.log(`Reverification complete: ${activeCount} active verified, ${expiredCount} expired.`);
  await db.close();
  process.exit(0);
}

main().catch(err => {
  console.error("Reverification failed:", err);
  process.exit(1);
});
