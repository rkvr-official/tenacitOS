import { NextRequest, NextResponse } from "next/server";
import { hubInstall } from "@/lib/clawhub";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const slug = String(body?.slug || "").trim();
    if (!slug) return NextResponse.json({ error: "slug is required" }, { status: 400 });

    const result = hubInstall(slug);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[skills/install]", error);
    return NextResponse.json({ error: "Failed to install skill" }, { status: 500 });
  }
}
