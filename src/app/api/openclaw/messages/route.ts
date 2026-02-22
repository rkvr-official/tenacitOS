import { NextRequest, NextResponse } from "next/server";
import { getSessionMessages } from "@/lib/openclaw";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agentId");
  const sessionId = searchParams.get("sessionId") || undefined;

  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  try {
    const data = getSessionMessages(agentId, sessionId);
    return NextResponse.json({ ...data, total: data.messages.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load messages", messages: [] },
      { status: 500 }
    );
  }
}
