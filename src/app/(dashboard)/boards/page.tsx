"use client";

import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, Plus, RefreshCw, Send, MessageSquare } from "lucide-react";

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

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<BoardTask["priority"]>("medium");
  const [newTaskAgentId, setNewTaskAgentId] = useState<string>("");
  const [creatingTask, setCreatingTask] = useState(false);

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
      const res = await fetch(`/api/boards/${activeBoardId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: newTaskDesc.trim() || undefined,
          priority: newTaskPriority,
          agentId: newTaskAgentId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setNewTaskTitle("");
      setNewTaskDesc("");
      setNewTaskPriority("medium");
      setNewTaskAgentId("");
      await loadBoards();
    } catch (e) {
      console.error(e);
    } finally {
      setCreatingTask(false);
    }
  };

  const moveTask = async (taskId: string, status: BoardTask["status"]) => {
    if (!activeBoardId) return;
    await fetch(`/api/boards/${activeBoardId}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => null);
    await loadBoards();
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
    const tasks = activeBoard?.tasks || [];
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
  }, [activeBoard]);

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
          {/* Task create */}
          <div className="mb-6 rounded-xl p-4" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
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

                <div className="p-3 space-y-3">
                  {grouped[col.id].length === 0 ? (
                    <div className="text-sm" style={{ color: "var(--text-muted)" }}>No tasks</div>
                  ) : null}

                  {grouped[col.id].map((t) => (
                    <div
                      key={t.id}
                      className="rounded-xl p-3"
                      style={{ backgroundColor: "var(--card-elevated)", border: "1px solid var(--border)" }}
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
                          onClick={() => openChatForTask(t)}
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
