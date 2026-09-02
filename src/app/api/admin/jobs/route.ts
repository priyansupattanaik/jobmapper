import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 50;
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : 0;

    const db = await getDb();
    const result = await db.searchJobs({
      limit,
      offset,
      sort_by: "freshness"
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch admin jobs" }, { status: 500 });
  }
}
