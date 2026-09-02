import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = await getDb();
    const health = await db.getSystemHealth();
    return NextResponse.json({
      system: "Job Mapper Production API",
      timestamp: new Date().toISOString(),
      ...health
    });
  } catch (error) {
    console.error("Admin health error:", error);
    return NextResponse.json({ error: "Health check failed" }, { status: 500 });
  }
}
