import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { CONTROLLED_TAXONOMY } from "@/lib/ai/taxonomy";

export async function GET() {
  try {
    const db = await getDb();
    const categories = Object.keys(CONTROLLED_TAXONOMY).map(name => ({
      name,
      subcategories: CONTROLLED_TAXONOMY[name].subcategories
    }));

    return NextResponse.json({ categories });
  } catch (error) {
    console.error("GET /api/categories error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
