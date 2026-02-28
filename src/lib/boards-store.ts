import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const DATA_PATH = path.join(process.cwd(), "data", "boards.json");

export type BoardColumnId = "backlog" | "in_progress" | "done";

export interface BoardTask {
  id: string;
  title: string;
  description?: string;
  status: BoardColumnId;
  priority: "low" | "medium" | "high" | "critical";
  position: number;
  createdAt: string;
  updatedAt: string;

  // Optional OpenClaw bindings for “agent texting”.
  agentId?: string;
  sessionId?: string;
  tags?: string[];
}

export interface Board {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  tasks: BoardTask[];
}

function ensureDataDir(): void {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function readBoards(): Board[] {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Board[]) : [];
  } catch {
    return [];
  }
}

export function writeBoards(boards: Board[]): void {
  ensureDataDir();
  fs.writeFileSync(DATA_PATH, JSON.stringify(boards, null, 2));
}

export function listBoards(): Board[] {
  return readBoards().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getBoard(boardId: string): Board | null {
  const b = readBoards().find((x) => x.id === boardId);
  return b ?? null;
}

export function createBoard(input: { name: string; description?: string }): Board {
  const now = new Date().toISOString();
  const boards = readBoards();
  const board: Board = {
    id: randomUUID(),
    name: input.name,
    description: input.description,
    createdAt: now,
    updatedAt: now,
    tasks: [],
  };
  boards.unshift(board);
  writeBoards(boards);
  return board;
}

export function updateBoard(boardId: string, patch: Partial<Pick<Board, "name" | "description">>): Board | null {
  const boards = readBoards();
  const idx = boards.findIndex((b) => b.id === boardId);
  if (idx === -1) return null;
  const now = new Date().toISOString();
  boards[idx] = {
    ...boards[idx],
    ...patch,
    updatedAt: now,
  };
  writeBoards(boards);
  return boards[idx];
}

export function deleteBoard(boardId: string): boolean {
  const boards = readBoards();
  const next = boards.filter((b) => b.id !== boardId);
  if (next.length === boards.length) return false;
  writeBoards(next);
  return true;
}

function normalizePositions(tasks: BoardTask[]): BoardTask[] {
  // Keep stable ordering inside each column.
  const byStatus: Record<BoardColumnId, BoardTask[]> = {
    backlog: [],
    in_progress: [],
    done: [],
  };
  for (const t of tasks) byStatus[t.status].push(t);

  const out: BoardTask[] = [];
  (Object.keys(byStatus) as BoardColumnId[]).forEach((status) => {
    const sorted = byStatus[status]
      .slice()
      .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
    sorted.forEach((t, i) => out.push({ ...t, position: i }));
  });
  return out;
}

export function createTask(
  boardId: string,
  input: Pick<BoardTask, "title"> &
    Partial<Pick<BoardTask, "description" | "priority" | "status" | "agentId" | "sessionId" | "tags">>
): BoardTask {
  const boards = readBoards();
  const idx = boards.findIndex((b) => b.id === boardId);
  if (idx === -1) throw new Error("board_not_found");

  const now = new Date().toISOString();
  const status: BoardColumnId = (input.status as BoardColumnId) || "backlog";

  const sameColCount = boards[idx].tasks.filter((t) => t.status === status).length;
  const task: BoardTask = {
    id: randomUUID(),
    title: input.title,
    description: input.description,
    status,
    priority: input.priority || "medium",
    position: sameColCount,
    createdAt: now,
    updatedAt: now,
    agentId: input.agentId,
    sessionId: input.sessionId,
    tags: input.tags,
  };

  boards[idx].tasks.push(task);
  boards[idx].tasks = normalizePositions(boards[idx].tasks);
  boards[idx].updatedAt = now;
  writeBoards(boards);

  return task;
}

export function updateTask(
  boardId: string,
  taskId: string,
  patch: Partial<Omit<BoardTask, "id" | "createdAt">>
): BoardTask | null {
  const boards = readBoards();
  const bidx = boards.findIndex((b) => b.id === boardId);
  if (bidx === -1) return null;

  const tidx = boards[bidx].tasks.findIndex((t) => t.id === taskId);
  if (tidx === -1) return null;

  const now = new Date().toISOString();
  const prev = boards[bidx].tasks[tidx];

  // If status changed and position not set, move to end of new column.
  let nextPosition = patch.position;
  if (patch.status && patch.status !== prev.status && nextPosition === undefined) {
    nextPosition = boards[bidx].tasks.filter((t) => t.status === patch.status).length;
  }

  boards[bidx].tasks[tidx] = {
    ...prev,
    ...patch,
    position: nextPosition ?? prev.position,
    updatedAt: now,
  };

  boards[bidx].tasks = normalizePositions(boards[bidx].tasks);
  boards[bidx].updatedAt = now;
  writeBoards(boards);
  return boards[bidx].tasks.find((t) => t.id === taskId) ?? null;
}

export function deleteTask(boardId: string, taskId: string): boolean {
  const boards = readBoards();
  const bidx = boards.findIndex((b) => b.id === boardId);
  if (bidx === -1) return false;

  const before = boards[bidx].tasks.length;
  boards[bidx].tasks = boards[bidx].tasks.filter((t) => t.id !== taskId);
  if (boards[bidx].tasks.length === before) return false;

  boards[bidx].tasks = normalizePositions(boards[bidx].tasks);
  boards[bidx].updatedAt = new Date().toISOString();
  writeBoards(boards);
  return true;
}
