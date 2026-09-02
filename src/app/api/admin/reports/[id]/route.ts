import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { z } from "zod";

const StatusSchema = z.object({
  status: z.enum(["pending", "reviewed", "dismissed", "action_taken"])
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const parsed = StatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const db = await getDb();
    await db.updateReportStatus(params.id, parsed.data.status);

    return NextResponse.json({ success: true, status: parsed.data.status });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update report" }, { status: 500 });
  }
}
