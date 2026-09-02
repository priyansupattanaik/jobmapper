import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = await getDb();
    const sources = await db.getAllSources();
    return NextResponse.json({ sources });
  } catch (error) {
    console.error("GET /api/sources error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
