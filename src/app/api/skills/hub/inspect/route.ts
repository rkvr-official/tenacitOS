import { NextRequest, NextResponse } from "next/server";
import { hubInspect } from "@/lib/clawhub";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = (searchParams.get("slug") || "").trim();
    if (!slug) return NextResponse.json({ error: "slug is required" }, { status: 400 });

    const data = hubInspect(slug);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[skills/hub/inspect]", error);
    return NextResponse.json({ error: "Failed to inspect skill" }, { status: 500 });
  }
}
