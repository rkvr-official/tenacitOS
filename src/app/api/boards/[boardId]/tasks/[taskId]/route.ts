import { NextRequest, NextResponse } from "next/server";
import { deleteTask, getBoard, updateTask } from "@/lib/boards-store";
import { logActivity } from "@/lib/activity-logger";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ boardId: string; taskId: string }> }
) {
  const { boardId, taskId } = await params;
  const board = getBoard(boardId);
  if (!board) return NextResponse.json({ error: "board_not_found" }, { status: 404 });
  const task = board.tasks.find((t) => t.id === taskId);
  if (!task) return NextResponse.json({ error: "task_not_found" }, { status: 404 });
  return NextResponse.json({ task });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string; taskId: string }> }
) {
  const { boardId, taskId } = await params;

  try {
    const body = await request.json().catch(() => null);
    const patch = body && typeof body === "object" ? body : {};

    const task = updateTask(boardId, taskId, patch);
    if (!task) return NextResponse.json({ error: "task_not_found" }, { status: 404 });

    logActivity("task", `Updated board task: ${task.title}`, "success", {
      metadata: { boardId, taskId, patch: Object.keys(patch) },
    });

    return NextResponse.json({ task });
  } catch (error) {
    console.error("[boards:tasks:update]", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ boardId: string; taskId: string }> }
) {
  const { boardId, taskId } = await params;
  const ok = deleteTask(boardId, taskId);
  if (!ok) return NextResponse.json({ error: "task_not_found" }, { status: 404 });

  logActivity("task", `Deleted board task: ${taskId}`, "success", { metadata: { boardId, taskId } });
  return NextResponse.json({ ok: true });
}
