import { NextRequest, NextResponse } from "next/server";
import { deleteBoard, getBoard, updateBoard } from "@/lib/boards-store";
import { logActivity } from "@/lib/activity-logger";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const board = getBoard(boardId);
  if (!board) return NextResponse.json({ error: "board_not_found" }, { status: 404 });
  return NextResponse.json({ board });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;

  const body = await request.json().catch(() => null);
  const patch: { name?: string; description?: string } = {};
  if (typeof body?.name === "string") patch.name = body.name;
  if (typeof body?.description === "string") patch.description = body.description;

  const board = updateBoard(boardId, patch);
  if (!board) return NextResponse.json({ error: "board_not_found" }, { status: 404 });

  logActivity("task", `Updated board: ${board.name}`, "success", { metadata: { boardId } });
  return NextResponse.json({ board });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const ok = deleteBoard(boardId);
  if (!ok) return NextResponse.json({ error: "board_not_found" }, { status: 404 });

  logActivity("task", `Deleted board: ${boardId}`, "success", { metadata: { boardId } });
  return NextResponse.json({ ok: true });
}
