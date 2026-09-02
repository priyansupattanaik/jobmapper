import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    if (!id) {
      return NextResponse.json({ error: "Missing job ID" }, { status: 400 });
    }

    const db = await getDb();
    const result = await db.getJobWithDuplicates(id);

    if (!result) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const auditLogs = await db.getAuditLogs(id);
    const source = await db.getSource(result.job.source_id);
    const company = await db.getCompany(result.job.company_id);

    return NextResponse.json({
      job: result.job,
      duplicates: result.duplicates,
      auditLogs,
      source,
      company
    });
  } catch (error) {
    console.error("GET /api/jobs/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
