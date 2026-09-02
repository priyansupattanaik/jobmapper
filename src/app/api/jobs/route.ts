import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { JobFilterSchema } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const query = searchParams.get("query") || undefined;
    const location = searchParams.get("location") || undefined;
    const latStr = searchParams.get("lat");
    const lngStr = searchParams.get("lng");
    const radiusStr = searchParams.get("radius_km");
    const workModeStr = searchParams.get("work_mode");
    const empTypeStr = searchParams.get("employment_type");
    const expLevelStr = searchParams.get("experience_level");
    const category = searchParams.get("category") || undefined;
    const salaryMinStr = searchParams.get("salary_min");
    const salaryMaxStr = searchParams.get("salary_max");
    const freshnessStr = searchParams.get("freshness_days");
    const remoteOnly = searchParams.get("remote_only") === "true";
    const sortBy = searchParams.get("sort_by") as any || "relevance";
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 50;
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : 0;

    const rawFilter = {
      query,
      location,
      lat: latStr ? parseFloat(latStr) : undefined,
      lng: lngStr ? parseFloat(lngStr) : undefined,
      radius_km: radiusStr ? parseFloat(radiusStr) : undefined,
      work_mode: workModeStr ? (workModeStr.split(",") as any) : undefined,
      employment_type: empTypeStr ? (empTypeStr.split(",") as any) : undefined,
      experience_level: expLevelStr ? (expLevelStr.split(",") as any) : undefined,
      category,
      salary_min: salaryMinStr ? parseFloat(salaryMinStr) : undefined,
      salary_max: salaryMaxStr ? parseFloat(salaryMaxStr) : undefined,
      freshness_days: freshnessStr ? parseInt(freshnessStr, 10) : undefined,
      remote_only: remoteOnly,
      sort_by: sortBy,
      limit,
      offset
    };

    const parsed = JobFilterSchema.safeParse(rawFilter);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid filter parameters", details: parsed.error.format() }, { status: 400 });
    }

    const db = await getDb();
    const results = await db.searchJobs(parsed.data);

    return NextResponse.json(results);
  } catch (error) {
    console.error("GET /api/jobs error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
