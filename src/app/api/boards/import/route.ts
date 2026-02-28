import { NextRequest, NextResponse } from "next/server";
import { writeBoards, type Board } from "@/lib/boards-store";
import { logActivity } from "@/lib/activity-logger";

export const dynamic = "force-dynamic";

function isBoard(x: unknown): x is Board {
  if (!x || typeof x !== "object") return false;
  const b = x as { id?: unknown; name?: unknown; tasks?: unknown };
  return typeof b.id === "string" && typeof b.name === "string" && Array.isArray(b.tasks);
}

export async function POST(request: NextRequest) {
  // Safety latch: require ?confirm=true to overwrite boards store.
  const { searchParams } = new URL(request.url);
  const confirm = searchParams.get("confirm") === "true";
  if (!confirm) {
    return NextResponse.json(
      { error: "confirm_required", message: "Re-send with ?confirm=true to apply import (overwrites boards)." },
      { status: 400 }
    );
  }

  try {
    const body = await request.json().catch(() => null);
    if (!Array.isArray(body) || !body.every(isBoard)) {
      return NextResponse.json({ error: "invalid_format" }, { status: 400 });
    }

    writeBoards(body);
    logActivity("task", `Imported boards backup (${body.length} boards)`, "success");

    return NextResponse.json({ ok: true, boards: body.length });
  } catch (error) {
    console.error("[boards:import]", error);
    return NextResponse.json({ error: "import_failed" }, { status: 500 });
  }
}
