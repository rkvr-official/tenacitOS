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
    const beforeBoard = getBoard(boardId);
    const before = beforeBoard?.tasks.find((t) => t.id === taskId);

    const body = await request.json().catch(() => null);
    const patch = body && typeof body === "object" ? body : {};

    const task = updateTask(boardId, taskId, patch);
    if (!task) return NextResponse.json({ error: "task_not_found" }, { status: 404 });

    const keys = Object.keys(patch);

    // Emit more specific events for high-signal changes.
    if (before?.status && patch?.status && before.status !== patch.status) {
      logActivity("task", `Moved task: ${task.title} → ${patch.status}`, "success", {
        metadata: { boardId, taskId, from: before.status, to: patch.status },
      });
    } else if (typeof patch?.position === "number") {
      logActivity("task", `Reordered task: ${task.title}`, "success", {
        metadata: { boardId, taskId, position: patch.position },
      });
    } else {
      logActivity("task", `Updated board task: ${task.title}`, "success", {
        metadata: { boardId, taskId, patch: keys },
      });
    }

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
