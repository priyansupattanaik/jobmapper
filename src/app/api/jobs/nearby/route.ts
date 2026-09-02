import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { JobFilterSchema } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const latStr = searchParams.get("lat");
    const lngStr = searchParams.get("lng");
    const radiusStr = searchParams.get("radius_km");
    const minLatStr = searchParams.get("min_lat");
    const maxLatStr = searchParams.get("max_lat");
    const minLngStr = searchParams.get("min_lng");
    const maxLngStr = searchParams.get("max_lng");

    const category = searchParams.get("category") || undefined;
    const workModeStr = searchParams.get("work_mode");
    const empTypeStr = searchParams.get("employment_type");
    const expLevelStr = searchParams.get("experience_level");
    const remoteOnly = searchParams.get("remote_only") === "true";
    const sortBy = (searchParams.get("sort_by") as any) || (latStr && lngStr ? "distance" : "relevance");
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 100;
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : 0;

    let viewport;
    if (minLatStr && maxLatStr && minLngStr && maxLngStr) {
      viewport = {
        min_lat: parseFloat(minLatStr),
        max_lat: parseFloat(maxLatStr),
        min_lng: parseFloat(minLngStr),
        max_lng: parseFloat(maxLngStr)
      };
    }

    const rawFilter = {
      lat: latStr ? parseFloat(latStr) : undefined,
      lng: lngStr ? parseFloat(lngStr) : undefined,
      radius_km: radiusStr ? parseFloat(radiusStr) : 50,
      viewport,
      category,
      work_mode: workModeStr ? (workModeStr.split(",") as any) : undefined,
      employment_type: empTypeStr ? (empTypeStr.split(",") as any) : undefined,
      experience_level: expLevelStr ? (expLevelStr.split(",") as any) : undefined,
      remote_only: remoteOnly,
      sort_by: sortBy,
      limit,
      offset
    };

    const parsed = JobFilterSchema.safeParse(rawFilter);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid spatial query parameters", details: parsed.error.format() }, { status: 400 });
    }

    const db = await getDb();
    const result = await db.findNearbyJobs(parsed.data);

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/jobs/nearby error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
