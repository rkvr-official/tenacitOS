import { NextRequest, NextResponse } from "next/server";
import { createBoard, listBoards } from "@/lib/boards-store";
import { logActivity } from "@/lib/activity-logger";

export const dynamic = "force-dynamic";

export async function GET() {
  const boards = listBoards();
  return NextResponse.json({ boards, total: boards.length });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const name = String(body?.name || "").trim();
    const description = body?.description ? String(body.description) : undefined;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const board = createBoard({ name, description });
    logActivity("task", `Created board: ${name}`, "success", { metadata: { boardId: board.id } });

    return NextResponse.json({ board }, { status: 201 });
  } catch (error) {
    console.error("[boards:create]", error);
    return NextResponse.json({ error: "Failed to create board" }, { status: 500 });
  }
}
