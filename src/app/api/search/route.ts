import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAIProvider } from "@/lib/ai";
import { getGeocoder } from "@/lib/pipeline/geocoder";
import { JobFilterSchema } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || searchParams.get("query");

    if (!query || !query.trim()) {
      return NextResponse.json({ error: "Missing search query" }, { status: 400 });
    }

    const ai = getAIProvider();
    const geocoder = getGeocoder();

    // 1. Convert natural language into structured intent
    const intent = await ai.parseSearchIntent(query);

    // 2. If intent has a location, geocode it
    let lat: number | undefined;
    let lng: number | undefined;
    if (intent.location) {
      const geo = await geocoder.geocode(intent.location);
      if (geo.latitude !== null && geo.longitude !== null) {
        lat = geo.latitude;
        lng = geo.longitude;
      }
    }

    // 3. Construct validated filters
    const filter = {
      query: intent.keywords.join(" ") || undefined,
      lat,
      lng,
      radius_km: intent.radius_km || (lat && lng ? 50 : undefined),
      work_mode: intent.work_mode.length > 0 ? (intent.work_mode as any) : undefined,
      employment_type: intent.employment_type.length > 0 ? (intent.employment_type as any) : undefined,
      experience_level: intent.experience_level.length > 0 ? (intent.experience_level as any) : undefined,
      category: intent.category || undefined,
      salary_min: intent.salary_min || undefined,
      salary_currency: intent.salary_currency || undefined,
      sort_by: (lat && lng ? "distance" : "relevance") as any,
      limit: 50,
      offset: 0
    };

    const parsed = JobFilterSchema.safeParse(filter);
    if (!parsed.success) {
      return NextResponse.json({ error: "Intent could not be validated", details: parsed.error.format() }, { status: 400 });
    }

    const db = await getDb();
    const results = await db.searchJobs(parsed.data);

    return NextResponse.json({
      query,
      parsedIntent: intent,
      appliedFilters: parsed.data,
      ...results
    });
  } catch (error) {
    console.error("GET /api/search error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
