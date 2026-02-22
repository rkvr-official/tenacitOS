import { NextRequest, NextResponse } from "next/server";
import { hubExplore } from "@/lib/clawhub";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") || "20")));
    const sort = (searchParams.get("sort") || "newest") as any;

    const all = hubExplore(200, sort);
    const start = (page - 1) * pageSize;
    const items = all.slice(start, start + pageSize);

    return NextResponse.json({ items, total: all.length, page, pageSize, totalPages: Math.max(1, Math.ceil(all.length / pageSize)) });
  } catch (error) {
    console.error("[skills/hub/explore]", error);
    return NextResponse.json({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 1, error: "Failed to explore ClawHub" }, { status: 500 });
  }
}
