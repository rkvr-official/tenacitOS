"use client";

import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, Plus, RefreshCw, Send, MessageSquare, Download, Upload, Trash2, Pencil } from "lucide-react";

interface BoardTask {
  id: string;
  title: string;
  description?: string;
  status: "backlog" | "in_progress" | "done";
  priority: "low" | "medium" | "high" | "critical";
  position: number;
  createdAt: string;
  updatedAt: string;
  agentId?: string;
  sessionId?: string;
  tags?: string[];
}

interface Board {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  tasks: BoardTask[];
}

interface Agent {
  id: string;
  name: string;
}

const columns = [
  { id: "backlog" as const, label: "Backlog" },
  { id: "in_progress" as const, label: "In Progress" },
  { id: "done" as const, label: "Done" },
];

export default function BoardsPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const [newBoardName, setNewBoardName] = useState("");
  const [creatingBoard, setCreatingBoard] = useState(false);

  const [renamingBoard, setRenamingBoard] = useState(false);
  const [deletingBoard, setDeletingBoard] = useState(false);
  const [importingBoards, setImportingBoards] = useState(false);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<BoardTask["priority"]>("medium");
  const [newTaskAgentId, setNewTaskAgentId] = useState<string>("");
  const [newTaskTags, setNewTaskTags] = useState<string>("");
  const [creatingTask, setCreatingTask] = useState(false);

  const [search, setSearch] = useState<string>("");
  const [tagFilter, setTagFilter] = useState<string>("");

  // Lightweight “agent texting” drawer
  const [chatOpen, setChatOpen] = useState(false);
  const [chatTaskId, setChatTaskId] = useState<string>("");
  const [chatAgentId, setChatAgentId] = useState<string>("");
  const [chatSessionId, setChatSessionId] = useState<string>("");
  const [chatDraft, setChatDraft] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ role?: string; content?: string; text?: string; timestamp?: string }>>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const [agents, setAgents] = useState<Agent[]>([]);

  const [draggingTaskId, setDraggingTaskId] = useState<string>("");

  const [selectedTask, setSelectedTask] = useState<BoardTask | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState<BoardTask["priority"]>("medium");
  const [editAgentId, setEditAgentId] = useState("");
  const [editTags, setEditTags] = useState("");
  const [savingTask, setSavingTask] = useState(false);
  const [deletingTask, setDeletingTask] = useState(false);
  const [saveOk, setSaveOk] = useState(false);

  const activeBoard = useMemo(() => boards.find((b) => b.id === activeBoardId) || null, [boards, activeBoardId]);

  const loadBoards = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/boards", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      const list: Board[] = Array.isArray(data?.boards) ? data.boards : [];
      setBoards(list);
      if (!activeBoardId && list.length) setActiveBoardId(list[0].id);
      if (activeBoardId && !list.some((b) => b.id === activeBoardId) && list.length) setActiveBoardId(list[0].id);
    } catch (e) {
      console.error(e);
      setBoards([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAgents = async () => {
    try {
      const res = await fetch("/api/openclaw/agents", { cache: "no-store" });
      const data = await res.json();
      const list = Array.isArray(data?.agents) ? data.agents : [];
      setAgents(
        list.map((a: unknown) => {
          const obj = a as { id?: unknown; name?: unknown };
          return { id: String(obj.id ?? ""), name: String(obj.name ?? obj.id ?? "") };
        })
      );
    } catch {
      setAgents([]);
    }
  };

  useEffect(() => {
    loadBoards();
    loadAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renameBoard = async () => {
    if (!activeBoardId || !activeBoard) return;
    const nextName = prompt("New board name", activeBoard.name);
    if (!nextName) return;

    setRenamingBoard(true);
    try {
      await fetch(`/api/boards/${activeBoardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName }),
      });
      await loadBoards();
    } finally {
      setRenamingBoard(false);
    }
  };

  const deleteBoard = async () => {
    if (!activeBoardId || !activeBoard) return;
    if (!confirm(`Delete board "${activeBoard.name}"? This deletes all tasks in it.`)) return;

    setDeletingBoard(true);
    try {
      await fetch(`/api/boards/${activeBoardId}`, { method: "DELETE" });
      setActiveBoardId("");
      await loadBoards();
    } finally {
      setDeletingBoard(false);
    }
  };

  const exportBoards = () => {
    window.location.href = "/api/boards/export";
  };

  const importBoards = async (file: File) => {
    setImportingBoards(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await fetch("/api/boards/import?confirm=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      await loadBoards();
    } finally {
      setImportingBoards(false);
    }
  };

  const createBoard = async () => {
    const name = newBoardName.trim();
    if (!name) return;
    setCreatingBoard(true);
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setNewBoardName("");
      await loadBoards();
      if (data?.board?.id) setActiveBoardId(String(data.board.id));
    } catch (e) {
      console.error(e);
    } finally {
      setCreatingBoard(false);
    }
  };

  const createTask = async () => {
    if (!activeBoardId) return;
    const title = newTaskTitle.trim();
    if (!title) return;

    setCreatingTask(true);
    try {
      const tags = newTaskTags
        .split(/[,;\s]+/)
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch(`/api/boards/${activeBoardId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: newTaskDesc.trim() || undefined,
          priority: newTaskPriority,
          agentId: newTaskAgentId || undefined,
          tags: tags.length ? tags : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setNewTaskTitle("");
      setNewTaskDesc("");
      setNewTaskPriority("medium");
      setNewTaskAgentId("");
      setNewTaskTags("");
      await loadBoards();
    } catch (e) {
      console.error(e);
    } finally {
      setCreatingTask(false);
    }
  };

  const updateTask = async (taskId: string, patch: Partial<BoardTask>) => {
    if (!activeBoardId) return;
    await fetch(`/api/boards/${activeBoardId}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => null);
    await loadBoards();
  };

  const moveTask = async (taskId: string, status: BoardTask["status"]) => {
    await updateTask(taskId, { status });
  };

  const moveTaskWithPosition = async (
    taskId: string,
    status: BoardTask["status"],
    position: number
  ) => {
    await updateTask(taskId, { status, position });
  };

  const openTaskModal = (task: BoardTask) => {
    setSelectedTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description || "");
    setEditPriority(task.priority);
    setEditAgentId(task.agentId || "");
    setEditTags((task.tags || []).join(", "));
  };

  const openChatForTask = async (task: BoardTask) => {
    setChatOpen(true);
    setChatTaskId(task.id);
    setChatAgentId(task.agentId || "");
    setChatSessionId(task.sessionId || "");
    setChatDraft("");
    setChatMessages([]);
    setChatError(null);

    if (!task.agentId) {
      setChatError("Assign an agent to this task to start chatting.");
      return;
    }

    await loadChat(task.agentId, task.sessionId);
  };

  const saveSelectedTask = async () => {
    if (!activeBoardId || !selectedTask) return;

    setSavingTask(true);
    setSaveOk(false);
    try {
      const tags = editTags
        .split(/[,;\s]+/)
        .map((t) => t.trim())
        .filter(Boolean);

      await updateTask(selectedTask.id, {
        title: editTitle.trim() || selectedTask.title,
        description: editDescription.trim() || undefined,
        priority: editPriority,
        agentId: editAgentId || undefined,
        tags: tags.length ? tags : undefined,
      });

      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 1200);
    } finally {
      setSavingTask(false);
    }
  };

  const deleteSelectedTask = async () => {
    if (!activeBoardId || !selectedTask) return;
    if (!confirm("Delete this task?")) return;

    setDeletingTask(true);
    try {
      await fetch(`/api/boards/${activeBoardId}/tasks/${selectedTask.id}`, { method: "DELETE" });
      setSelectedTask(null);
      await loadBoards();
    } finally {
      setDeletingTask(false);
    }
  };

  const loadChat = async (agentId: string, sessionId?: string) => {
    setChatLoading(true);
    setChatError(null);
    try {
      const url = new URL("/api/openclaw/messages", window.location.origin);
      url.searchParams.set("agentId", agentId);
      if (sessionId) url.searchParams.set("sessionId", sessionId);
      const res = await fetch(url.toString(), { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setChatMessages(Array.isArray(data?.messages) ? data.messages : []);
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "Failed to load messages");
      setChatMessages([]);
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    if (!chatOpen || !chatAgentId) return;
    const interval = setInterval(() => {
      loadChat(chatAgentId, chatSessionId || undefined);
    }, 3000);
    return () => clearInterval(interval);
  }, [chatOpen, chatAgentId, chatSessionId]);

  const sendChat = async () => {
    if (!activeBoardId || !chatTaskId || !chatAgentId) return;
    const msg = chatDraft.trim();
    if (!msg) return;

    setChatSending(true);
    setChatError(null);
    try {
      const res = await fetch("/api/openclaw/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: chatAgentId, message: msg, sessionId: chatSessionId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      const nextSessionId = data?.sessionId ? String(data.sessionId) : chatSessionId;
      setChatSessionId(nextSessionId);

      // Persist sessionId onto the task so we continue the same conversation.
      await fetch(`/api/boards/${activeBoardId}/tasks/${chatTaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: chatAgentId, sessionId: nextSessionId }),
      }).catch(() => null);

      setChatDraft("");
      await loadBoards();
      await loadChat(chatAgentId, nextSessionId);
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setChatSending(false);
    }
  };

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const tagq = tagFilter.trim().toLowerCase();

    const tasksAll = activeBoard?.tasks || [];
    const tasks = tasksAll.filter((t) => {
      const hay = `${t.title} ${t.description || ""}`.toLowerCase();
      if (q && !hay.includes(q)) return false;
      if (tagq) {
        const tags = (t.tags || []).map((x) => x.toLowerCase());
        if (!tags.some((x) => x.includes(tagq))) return false;
      }
      return true;
    });
    const by: Record<BoardTask["status"], BoardTask[]> = {
      backlog: [],
      in_progress: [],
      done: [],
    };
    for (const t of tasks) by[t.status].push(t);
    for (const k of Object.keys(by) as BoardTask["status"][]) {
      by[k] = by[k].slice().sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
    }
    return by;
  }, [activeBoard, search, tagFilter]);

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1
            className="text-3xl font-bold mb-2"
            style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)", letterSpacing: "-1.5px" }}
          >
            <LayoutGrid className="inline-block w-8 h-8 mr-2 mb-1" />
            Boards
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            Lightweight kanban boards stored locally (no DB)
          </p>
        </div>
        <button
          onClick={loadBoards}
          disabled={loading}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 0.85rem",
            borderRadius: "0.6rem",
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          <RefreshCw className={loading ? "w-4 h-4 animate-spin" : "w-4 h-4"} />
          Refresh
        </button>
      </div>

      {/* Board picker + create */}
      <div
        className="mb-6 rounded-xl p-4"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex items-center gap-2 md:order-last">
            <button
              onClick={exportBoards}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.55rem 0.75rem",
                borderRadius: "0.6rem",
                border: "1px solid var(--border)",
                backgroundColor: "rgba(42,42,42,0.35)",
                color: "var(--text-secondary)",
                cursor: "pointer",
                fontSize: "13px",
              }}
              title="Export boards backup"
            >
              <Download className="w-4 h-4" /> Export
            </button>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.55rem 0.75rem",
                borderRadius: "0.6rem",
                border: "1px solid var(--border)",
                backgroundColor: "rgba(42,42,42,0.35)",
                color: "var(--text-secondary)",
                cursor: importingBoards ? "not-allowed" : "pointer",
                opacity: importingBoards ? 0.6 : 1,
                fontSize: "13px",
              }}
              title="Import boards backup (overwrites)"
            >
              <Upload className="w-4 h-4" /> Import
              <input
                type="file"
                accept="application/json"
                disabled={importingBoards}
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importBoards(f).catch(console.error);
                  e.currentTarget.value = "";
                }}
              />
            </label>

            <button
              onClick={renameBoard}
              disabled={!activeBoard || renamingBoard}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.55rem 0.75rem",
                borderRadius: "0.6rem",
                border: "1px solid var(--border)",
                backgroundColor: "rgba(42,42,42,0.35)",
                color: "var(--text-secondary)",
                cursor: !activeBoard || renamingBoard ? "not-allowed" : "pointer",
                opacity: !activeBoard || renamingBoard ? 0.6 : 1,
                fontSize: "13px",
              }}
              title="Rename active board"
            >
              <Pencil className="w-4 h-4" /> Rename
            </button>

            <button
              onClick={deleteBoard}
              disabled={!activeBoard || deletingBoard}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.55rem 0.75rem",
                borderRadius: "0.6rem",
                border: "1px solid var(--border)",
                backgroundColor: "rgba(255, 59, 48, 0.10)",
                color: "var(--accent)",
                cursor: !activeBoard || deletingBoard ? "not-allowed" : "pointer",
                opacity: !activeBoard || deletingBoard ? 0.6 : 1,
                fontSize: "13px",
              }}
              title="Delete active board"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          </div>
          <div className="flex-1">
            <label className="block text-xs mb-2" style={{ color: "var(--text-muted)" }}>
              Active board
            </label>
            <select
              value={activeBoardId}
              onChange={(e) => setActiveBoardId(e.target.value)}
              style={{
                width: "100%",
                backgroundColor: "rgba(42, 42, 42, 0.5)",
                color: "var(--text-secondary)",
                padding: "0.6rem 0.75rem",
                borderRadius: "0.6rem",
                border: "1px solid var(--border)",
                outline: "none",
              }}
            >
              {boards.length === 0 ? <option value="">(no boards yet)</option> : null}
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:w-[360px]">
            <label className="block text-xs mb-2" style={{ color: "var(--text-muted)" }}>
              Create new board
            </label>
            <div className="flex gap-2">
              <input
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                placeholder="e.g. TenacitOS vNext"
                style={{
                  flex: 1,
                  backgroundColor: "rgba(42, 42, 42, 0.5)",
                  color: "var(--text-secondary)",
                  padding: "0.6rem 0.75rem",
                  borderRadius: "0.6rem",
                  border: "1px solid var(--border)",
                  outline: "none",
                }}
              />
              <button
                onClick={createBoard}
                disabled={creatingBoard || !newBoardName.trim()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.6rem 0.85rem",
                  borderRadius: "0.6rem",
                  border: "1px solid var(--border)",
                  backgroundColor: "rgba(255, 59, 48, 0.15)",
                  color: "var(--accent)",
                  cursor: creatingBoard ? "not-allowed" : "pointer",
                  opacity: creatingBoard ? 0.7 : 1,
                }}
              >
                <Plus className="w-4 h-4" />
                Create
              </button>
            </div>
          </div>
        </div>
      </div>

      {activeBoard ? (
        <>
          {/* Task create + filters */}
          <div className="mb-6 rounded-xl p-4" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-6">
                <label className="block text-xs mb-2" style={{ color: "var(--text-muted)" }}>Search</label>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search title/description…"
                  style={{
                    width: "100%",
                    backgroundColor: "rgba(42, 42, 42, 0.5)",
                    color: "var(--text-secondary)",
                    padding: "0.6rem 0.75rem",
                    borderRadius: "0.6rem",
                    border: "1px solid var(--border)",
                    outline: "none",
                  }}
                />
              </div>
              <div className="md:col-span-6">
                <label className="block text-xs mb-2" style={{ color: "var(--text-muted)" }}>Tag filter</label>
                <input
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  placeholder="e.g. ui, urgent"
                  style={{
                    width: "100%",
                    backgroundColor: "rgba(42, 42, 42, 0.5)",
                    color: "var(--text-secondary)",
                    padding: "0.6rem 0.75rem",
                    borderRadius: "0.6rem",
                    border: "1px solid var(--border)",
                    outline: "none",
                  }}
                />
              </div>
              <div className="md:col-span-4">
                <label className="block text-xs mb-2" style={{ color: "var(--text-muted)" }}>Title</label>
                <input
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="New task…"
                  style={{
                    width: "100%",
                    backgroundColor: "rgba(42, 42, 42, 0.5)",
                    color: "var(--text-secondary)",
                    padding: "0.6rem 0.75rem",
                    borderRadius: "0.6rem",
                    border: "1px solid var(--border)",
                    outline: "none",
                  }}
                />
              </div>
              <div className="md:col-span-4">
                <label className="block text-xs mb-2" style={{ color: "var(--text-muted)" }}>Description (optional)</label>
                <input
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  placeholder="What needs to happen?"
                  style={{
                    width: "100%",
                    backgroundColor: "rgba(42, 42, 42, 0.5)",
                    color: "var(--text-secondary)",
                    padding: "0.6rem 0.75rem",
                    borderRadius: "0.6rem",
                    border: "1px solid var(--border)",
                    outline: "none",
                  }}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs mb-2" style={{ color: "var(--text-muted)" }}>Priority</label>
                <select
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value as BoardTask["priority"])}
                  style={{
                    width: "100%",
                    backgroundColor: "rgba(42, 42, 42, 0.5)",
                    color: "var(--text-secondary)",
                    padding: "0.6rem 0.75rem",
                    borderRadius: "0.6rem",
                    border: "1px solid var(--border)",
                    outline: "none",
                  }}
                >
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                  <option value="critical">critical</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs mb-2" style={{ color: "var(--text-muted)" }}>Agent (optional)</label>
                <select
                  value={newTaskAgentId}
                  onChange={(e) => setNewTaskAgentId(e.target.value)}
                  style={{
                    width: "100%",
                    backgroundColor: "rgba(42, 42, 42, 0.5)",
                    color: "var(--text-secondary)",
                    padding: "0.6rem 0.75rem",
                    borderRadius: "0.6rem",
                    border: "1px solid var(--border)",
                    outline: "none",
                  }}
                >
                  <option value="">(none)</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-10">
                <label className="block text-xs mb-2" style={{ color: "var(--text-muted)" }}>Tags (optional)</label>
                <input
                  value={newTaskTags}
                  onChange={(e) => setNewTaskTags(e.target.value)}
                  placeholder="ui, kanban, urgent"
                  style={{
                    width: "100%",
                    backgroundColor: "rgba(42, 42, 42, 0.5)",
                    color: "var(--text-secondary)",
                    padding: "0.6rem 0.75rem",
                    borderRadius: "0.6rem",
                    border: "1px solid var(--border)",
                    outline: "none",
                  }}
                />
              </div>
              <div className="md:col-span-12 flex justify-end">
                <button
                  onClick={createTask}
                  disabled={creatingTask || !newTaskTitle.trim()}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.6rem 0.95rem",
                    borderRadius: "0.6rem",
                    border: "1px solid var(--border)",
                    backgroundColor: "rgba(255, 59, 48, 0.15)",
                    color: "var(--accent)",
                    cursor: creatingTask ? "not-allowed" : "pointer",
                    opacity: creatingTask ? 0.7 : 1,
                  }}
                >
                  <Plus className="w-4 h-4" />
                  Add task
                </button>
              </div>
            </div>
          </div>

          {/* Kanban */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {columns.map((col) => (
              <div key={col.id} className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between">
                    <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{col.label}</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{grouped[col.id].length}</div>
                  </div>
                </div>

                <div
                  className="p-3 space-y-3"
                  onDragOver={(e) => {
                    if (!draggingTaskId) return;
                    e.preventDefault();
                  }}
                  onDrop={async (e) => {
                    if (!draggingTaskId) return;
                    e.preventDefault();
                    const taskId = draggingTaskId;
                    setDraggingTaskId("");
                    // Drop into column → move to end of column.
                    const targetIndex = grouped[col.id].length;
                    await moveTaskWithPosition(taskId, col.id, targetIndex);
                  }}
                >
                  {grouped[col.id].length === 0 ? (
                    <div className="text-sm" style={{ color: "var(--text-muted)" }}>No tasks</div>
                  ) : null}

                  {grouped[col.id].map((t, idx) => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={() => setDraggingTaskId(t.id)}
                      onDragEnd={() => setDraggingTaskId("")}
                      onDragOver={(e) => {
                        if (!draggingTaskId || draggingTaskId === t.id) return;
                        e.preventDefault();
                      }}
                      onDrop={async (e) => {
                        if (!draggingTaskId || draggingTaskId === t.id) return;
                        e.preventDefault();
                        const taskId = draggingTaskId;
                        setDraggingTaskId("");
                        // Drop onto a task → insert at this index.
                        await moveTaskWithPosition(taskId, col.id, idx);
                      }}
                      onClick={() => {
                        // Avoid click-open while dragging.
                        if (draggingTaskId) return;
                        openTaskModal(t);
                      }}
                      className="rounded-xl p-3"
                      style={{
                        backgroundColor: "var(--card-elevated)",
                        border: draggingTaskId === t.id ? "1px solid var(--accent)" : "1px solid var(--border)",
                        cursor: "grab",
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: "var(--text-primary)", wordBreak: "break-word" }}>{t.title}</div>
                          {t.description ? (
                            <div className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{t.description}</div>
                          ) : null}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>{t.priority}</div>
                      </div>

                      {t.tags && t.tags.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {t.tags.map((tag) => (
                            <button
                              key={tag}
                              onClick={() => setTagFilter(tag)}
                              title="Filter by tag"
                              style={{
                                padding: "0.15rem 0.55rem",
                                borderRadius: "9999px",
                                border: "1px solid var(--border)",
                                backgroundColor: "rgba(255, 59, 48, 0.10)",
                                color: "var(--accent)",
                                cursor: "pointer",
                                fontSize: "11px",
                              }}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      ) : null}

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="flex gap-2">
                          {t.status !== "backlog" ? (
                            <button
                              onClick={() => moveTask(t.id, "backlog")}
                              style={{
                                padding: "0.35rem 0.6rem",
                                borderRadius: "0.5rem",
                                border: "1px solid var(--border)",
                                backgroundColor: "rgba(42,42,42,0.35)",
                                color: "var(--text-secondary)",
                                cursor: "pointer",
                                fontSize: "12px",
                              }}
                            >
                              Backlog
                            </button>
                          ) : null}
                          {t.status !== "in_progress" ? (
                            <button
                              onClick={() => moveTask(t.id, "in_progress")}
                              style={{
                                padding: "0.35rem 0.6rem",
                                borderRadius: "0.5rem",
                                border: "1px solid var(--border)",
                                backgroundColor: "rgba(42,42,42,0.35)",
                                color: "var(--text-secondary)",
                                cursor: "pointer",
                                fontSize: "12px",
                              }}
                            >
                              In progress
                            </button>
                          ) : null}
                          {t.status !== "done" ? (
                            <button
                              onClick={() => moveTask(t.id, "done")}
                              style={{
                                padding: "0.35rem 0.6rem",
                                borderRadius: "0.5rem",
                                border: "1px solid var(--border)",
                                backgroundColor: "rgba(42,42,42,0.35)",
                                color: "var(--text-secondary)",
                                cursor: "pointer",
                                fontSize: "12px",
                              }}
                            >
                              Done
                            </button>
                          ) : null}
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openChatForTask(t);
                          }}
                          title="Chat with agent"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.4rem",
                            padding: "0.35rem 0.6rem",
                            borderRadius: "0.5rem",
                            border: "1px solid var(--border)",
                            backgroundColor: "rgba(255, 59, 48, 0.12)",
                            color: "var(--accent)",
                            cursor: "pointer",
                            fontSize: "12px",
                          }}
                        >
                          <MessageSquare className="w-4 h-4" />
                          Chat
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-xl p-6" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
          Create your first board to get started.
        </div>
      )}

      {/* Task modal */}
      {selectedTask && (
        <div
          onClick={() => setSelectedTask(null)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.55)",
            zIndex: 90,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "18px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(720px, 100%)",
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "14px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <div>
                <div style={{ fontWeight: 800, color: "var(--text-primary)" }}>Task details</div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  {selectedTask.id}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                  Status: <span style={{ fontFamily: "var(--font-mono)" }}>{selectedTask.status}</span>
                  {selectedTask.agentId ? (
                    <> • Agent: <span style={{ fontFamily: "var(--font-mono)" }}>{selectedTask.agentId}</span></>
                  ) : null}
                  {selectedTask.sessionId ? (
                    <> • Session: <span style={{ fontFamily: "var(--font-mono)" }}>{selectedTask.sessionId}</span></>
                  ) : null}
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={deleteSelectedTask}
                  disabled={deletingTask}
                  style={{
                    padding: "0.45rem 0.75rem",
                    borderRadius: "0.6rem",
                    border: "1px solid var(--border)",
                    backgroundColor: "rgba(255, 59, 48, 0.10)",
                    color: "var(--accent)",
                    cursor: deletingTask ? "not-allowed" : "pointer",
                    opacity: deletingTask ? 0.7 : 1,
                    fontSize: "13px",
                  }}
                >
                  Delete
                </button>
                <button
                  onClick={() => setSelectedTask(null)}
                  style={{
                    padding: "0.45rem 0.75rem",
                    borderRadius: "0.6rem",
                    border: "1px solid var(--border)",
                    backgroundColor: "rgba(42,42,42,0.35)",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                >
                  Close
                </button>
              </div>
            </div>

            <div style={{ padding: "14px 16px", display: "grid", gap: "10px" }}>
              <label style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Title
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  style={{
                    marginTop: "6px",
                    width: "100%",
                    backgroundColor: "rgba(42, 42, 42, 0.5)",
                    color: "var(--text-secondary)",
                    padding: "0.65rem 0.75rem",
                    borderRadius: "0.6rem",
                    border: "1px solid var(--border)",
                    outline: "none",
                  }}
                />
              </label>

              <label style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Description
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={4}
                  style={{
                    marginTop: "6px",
                    width: "100%",
                    backgroundColor: "rgba(42, 42, 42, 0.5)",
                    color: "var(--text-secondary)",
                    padding: "0.65rem 0.75rem",
                    borderRadius: "0.6rem",
                    border: "1px solid var(--border)",
                    outline: "none",
                    resize: "vertical",
                  }}
                />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <label style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  Priority
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as BoardTask["priority"])}
                    style={{
                      marginTop: "6px",
                      width: "100%",
                      backgroundColor: "rgba(42, 42, 42, 0.5)",
                      color: "var(--text-secondary)",
                      padding: "0.65rem 0.75rem",
                      borderRadius: "0.6rem",
                      border: "1px solid var(--border)",
                      outline: "none",
                    }}
                  >
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                    <option value="critical">critical</option>
                  </select>
                </label>

                <label style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  Agent
                  <select
                    value={editAgentId}
                    onChange={(e) => setEditAgentId(e.target.value)}
                    style={{
                      marginTop: "6px",
                      width: "100%",
                      backgroundColor: "rgba(42, 42, 42, 0.5)",
                      color: "var(--text-secondary)",
                      padding: "0.65rem 0.75rem",
                      borderRadius: "0.6rem",
                      border: "1px solid var(--border)",
                      outline: "none",
                    }}
                  >
                    <option value="">(none)</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Tags
                <input
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  placeholder="ui, backend, urgent"
                  style={{
                    marginTop: "6px",
                    width: "100%",
                    backgroundColor: "rgba(42, 42, 42, 0.5)",
                    color: "var(--text-secondary)",
                    padding: "0.65rem 0.75rem",
                    borderRadius: "0.6rem",
                    border: "1px solid var(--border)",
                    outline: "none",
                  }}
                />
              </label>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                {saveOk ? (
                  <div style={{ fontSize: "12px", color: "var(--success)" }}>Saved</div>
                ) : null}
                <button
                  onClick={saveSelectedTask}
                  disabled={savingTask || !editTitle.trim()}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    padding: "0.65rem 0.95rem",
                    borderRadius: "0.65rem",
                    border: "1px solid var(--border)",
                    backgroundColor: "rgba(255, 59, 48, 0.15)",
                    color: "var(--accent)",
                    cursor: savingTask ? "not-allowed" : "pointer",
                    opacity: savingTask ? 0.75 : 1,
                    fontSize: "13px",
                    fontWeight: 700,
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat drawer */}
      {chatOpen && (
        <div
          style={{
            position: "fixed",
            right: 0,
            top: 48,
            bottom: 32,
            width: "min(520px, 100vw)",
            backgroundColor: "var(--surface)",
            borderLeft: "1px solid var(--border)",
            zIndex: 80,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>Agent chat</div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Task: <span style={{ fontFamily: "var(--font-mono)" }}>{chatTaskId.slice(0, 8)}</span>
              </div>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              style={{
                padding: "0.35rem 0.6rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border)",
                backgroundColor: "rgba(42,42,42,0.35)",
                color: "var(--text-secondary)",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              Close
            </button>
          </div>

          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
            <label className="block text-xs mb-2" style={{ color: "var(--text-muted)" }}>Agent</label>
            <select
              value={chatAgentId}
              onChange={async (e) => {
                const id = e.target.value;
                setChatAgentId(id);
                setChatSessionId("");
                setChatMessages([]);
                setChatError(null);
                if (id) await loadChat(id);
              }}
              style={{
                width: "100%",
                backgroundColor: "rgba(42, 42, 42, 0.5)",
                color: "var(--text-secondary)",
                padding: "0.6rem 0.75rem",
                borderRadius: "0.6rem",
                border: "1px solid var(--border)",
                outline: "none",
              }}
            >
              <option value="">(select)</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            {chatError ? <div className="mt-2 text-sm" style={{ color: "var(--error)" }}>{chatError}</div> : null}
          </div>

          <div style={{ flex: 1, overflow: "auto", padding: "12px 16px" }}>
            {chatLoading ? (
              <div style={{ color: "var(--text-muted)", fontSize: "14px" }}>Loading messages…</div>
            ) : chatMessages.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: "14px" }}>No messages yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {chatMessages.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "10px",
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      color: "var(--text-secondary)",
                      fontSize: "13px",
                      lineHeight: 1.4,
                    }}
                  >
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>
                      {(m.role || "message").toString()}
                      {m.timestamp ? ` • ${new Date(m.timestamp).toLocaleString()}` : ""}
                    </div>
                    <div style={{ whiteSpace: "pre-wrap" }}>{(m.content || m.text || "").toString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                placeholder={chatAgentId ? "Type a message…" : "Select an agent first"}
                disabled={!chatAgentId || chatSending}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendChat();
                }}
                style={{
                  flex: 1,
                  backgroundColor: "rgba(42, 42, 42, 0.5)",
                  color: "var(--text-secondary)",
                  padding: "0.6rem 0.75rem",
                  borderRadius: "0.6rem",
                  border: "1px solid var(--border)",
                  outline: "none",
                }}
              />
              <button
                onClick={sendChat}
                disabled={!chatAgentId || chatSending || !chatDraft.trim()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.6rem 0.85rem",
                  borderRadius: "0.6rem",
                  border: "1px solid var(--border)",
                  backgroundColor: "rgba(255, 59, 48, 0.15)",
                  color: "var(--accent)",
                  cursor: chatSending ? "not-allowed" : "pointer",
                  opacity: chatSending ? 0.7 : 1,
                }}
              >
                <Send className={chatSending ? "w-4 h-4 animate-pulse" : "w-4 h-4"} />
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
