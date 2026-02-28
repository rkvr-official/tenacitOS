import { NextRequest, NextResponse } from "next/server";
import { createTask, getBoard } from "@/lib/boards-store";
import { logActivity } from "@/lib/activity-logger";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const board = getBoard(boardId);
  if (!board) return NextResponse.json({ error: "board_not_found" }, { status: 404 });
  return NextResponse.json({ tasks: board.tasks, total: board.tasks.length });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;

  try {
    const body = await request.json().catch(() => null);
    const title = String(body?.title || "").trim();
    if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

    const task = createTask(boardId, {
      title,
      description: typeof body?.description === "string" ? body.description : undefined,
      priority: body?.priority,
      status: body?.status,
      agentId: typeof body?.agentId === "string" ? body.agentId : undefined,
      sessionId: typeof body?.sessionId === "string" ? body.sessionId : undefined,
      tags: Array.isArray(body?.tags) ? body.tags.map(String) : undefined,
    });

    logActivity("task", `Created board task: ${title}`, "success", { metadata: { boardId, taskId: task.id } });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error("[boards:tasks:create]", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
