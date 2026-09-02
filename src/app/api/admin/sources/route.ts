import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = await getDb();
    const sources = await db.getAllSources();
    return NextResponse.json({ sources });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch sources" }, { status: 500 });
  }
}
