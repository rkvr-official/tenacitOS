import { NextResponse } from "next/server";
import { runOpenclawJson } from "@/lib/openclaw";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = runOpenclawJson(["status"]);
    return NextResponse.json(status);
  } catch (error) {
    console.error("[openclaw/status]", error);
    return NextResponse.json({ error: "Failed to get OpenClaw status" }, { status: 500 });
  }
}
