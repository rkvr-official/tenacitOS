import { NextRequest, NextResponse } from "next/server";
import { hubSkillMd } from "@/lib/clawhub";

export const revalidate = 300;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = String(searchParams.get("slug") || "").trim();
    if (!slug) return NextResponse.json({ error: "slug is required" }, { status: 400 });

    const content = hubSkillMd(slug);
    return NextResponse.json({ slug, content });
  } catch (error) {
    console.error("[skills/hub/skill-md]", error);
    return NextResponse.json({ error: "Failed to load SKILL.md" }, { status: 500 });
  }
}
