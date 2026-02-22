import { NextRequest, NextResponse } from "next/server";
import { sendAgentMessage } from "@/lib/openclaw";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const agentId = String(body?.agentId || "").trim();
    const message = String(body?.message || "").trim();
    const sessionId = body?.sessionId ? String(body.sessionId) : undefined;

    if (!agentId) {
      return NextResponse.json({ error: "agentId is required" }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const result = sendAgentMessage(agentId, message, sessionId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[openclaw/chat]", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
