import { NextRequest, NextResponse } from "next/server";
import { hubSearch } from "@/lib/clawhub";

export const revalidate = 300;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();
    const limit = Number(searchParams.get("limit") || "50");

    if (!q) return NextResponse.json({ skills: [] });
    const skills = hubSearch(q, Number.isFinite(limit) ? limit : 50);
    return NextResponse.json({ skills });
  } catch (error) {
    console.error("[skills/hub/search]", error);
    return NextResponse.json({ skills: [], error: "Failed to search ClawHub" }, { status: 500 });
  }
}
