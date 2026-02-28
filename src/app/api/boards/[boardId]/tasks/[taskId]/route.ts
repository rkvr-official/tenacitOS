import { NextRequest, NextResponse } from "next/server";
import { deleteTask, getBoard, updateTask } from "@/lib/boards-store";
import { logActivity } from "@/lib/activity-logger";
import { sendAgentMessage } from "@/lib/openclaw";

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

      // If task moved to in_progress and has an agent, trigger the agent with context.
      if (patch.status === "in_progress" && task.agentId) {
        try {
          const board = getBoard(boardId);
          const msg = [
            `You have a task in progress (board: ${board?.name || boardId}).`,
            `Title: ${task.title}`,
            task.description ? `Description: ${task.description}` : null,
            task.tags?.length ? `Tags: ${task.tags.join(", ")}` : null,
            "\nReply here with progress updates.",
          ]
            .filter(Boolean)
            .join("\n");

          const result = sendAgentMessage(task.agentId, msg, task.sessionId);
          if (result?.sessionId && result.sessionId !== task.sessionId) {
            updateTask(boardId, taskId, { sessionId: result.sessionId });
          }

          logActivity("agent_action", `Triggered agent ${task.agentId} for task: ${task.title}`, "success", {
            metadata: { boardId, taskId, agentId: task.agentId, sessionId: result?.sessionId },
          });
        } catch (e) {
          logActivity("agent_action", `Failed triggering agent for task: ${task.title}`, "error", {
            metadata: { boardId, taskId, error: e instanceof Error ? e.message : String(e) },
          });
        }
      }
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
