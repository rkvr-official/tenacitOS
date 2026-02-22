import { NextRequest, NextResponse } from "next/server";
import { getSessions } from "@/lib/openclaw";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agentId");

  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  try {
    const sessions = getSessions(agentId);
    return NextResponse.json({ agentId, sessions, total: sessions.length });
  } catch (error) {
    console.error("[openclaw/sessions]", error);
    return NextResponse.json({ error: "Failed to load sessions", sessions: [] }, { status: 500 });
  }
}
