import { NextResponse } from "next/server";
import { getAgents } from "@/lib/openclaw";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const agents = getAgents();
    return NextResponse.json({ agents });
  } catch (error) {
    console.error("[openclaw/agents]", error);
    return NextResponse.json({ error: "Failed to load agents" }, { status: 500 });
  }
}
