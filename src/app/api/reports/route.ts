import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ReportReasonEnum } from "@/lib/types";
import { z } from "zod";

const ReportInputSchema = z.object({
  job_id: z.string().min(1),
  reason: ReportReasonEnum,
  details: z.string().max(1000).default("")
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ReportInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid report data", details: parsed.error.format() }, { status: 400 });
    }

    const db = await getDb();
    const existingJob = await db.getJob(parsed.data.job_id);
    if (!existingJob) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const reportId = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await db.saveReport({
      id: reportId,
      job_id: parsed.data.job_id,
      reason: parsed.data.reason,
      details: parsed.data.details,
      status: "pending",
      created_at: new Date().toISOString()
    });

    return NextResponse.json({ success: true, message: "Thank you. Your report has been submitted for verification.", reportId });
  } catch (error) {
    console.error("POST /api/reports error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
