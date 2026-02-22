"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, Circle, MessageSquare, Send, Users } from "lucide-react";
import { AgentOrganigrama } from "@/components/AgentOrganigrama";

interface Agent {
  id: string;
  name: string;
  emoji: string;
  color: string;
  model: string;
  workspace: string;
  status: "online" | "offline";
  currentState: "ACTIVE" | "IDLE" | "SLEEPING";
  isOrchestrator: boolean;
  lastActivity?: string;
  activeSessions: number;
}

interface Session {
  id: string;
  sessionId: string | null;
  updatedAt: number;
}

interface Msg {
  id: string;
  type: "user" | "assistant" | "tool_use" | "tool_result" | "system";
  content: string;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"cards" | "organigrama" | "chat">("cards");

  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId),
    [agents, selectedAgentId]
  );

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedAgentId) return;
    fetch(`/api/openclaw/sessions?agentId=${encodeURIComponent(selectedAgentId)}`)
      .then((r) => r.json())
      .then((data) => {
        const nextSessions = data.sessions || [];
        setSessions(nextSessions);
        if (!selectedSessionId) {
          setSelectedSessionId(nextSessions[0]?.sessionId || "");
        }
      })
      .catch(console.error);
  }, [selectedAgentId]);

  useEffect(() => {
    if (!selectedAgentId) return;
    const qs = new URLSearchParams({ agentId: selectedAgentId });
    if (selectedSessionId) qs.set("sessionId", selectedSessionId);

    fetch(`/api/openclaw/messages?${qs.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setMessages(data.messages || []);
        if (data.sessionId && data.sessionId !== selectedSessionId) {
          setSelectedSessionId(data.sessionId);
        }
      })
      .catch(console.error);
  }, [selectedAgentId, selectedSessionId]);

  const fetchAgents = async () => {
    try {
      const res = await fetch("/api/openclaw/agents");
      const data = await res.json();
      const list = data.agents || [];
      setAgents(list);
      if (!selectedAgentId && list.length > 0) setSelectedAgentId(list[0].id);
    } catch (error) {
      console.error("Error fetching agents:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatLastActivity = (timestamp?: string) => {
    if (!timestamp) return "Never";
    const date = new Date(timestamp);
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const sendMessage = async () => {
    const message = prompt.trim();
    if (!message || !selectedAgentId || sending) return;

    setSending(true);
    setPrompt("");
    try {
      const res = await fetch("/api/openclaw/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: selectedAgentId,
          message,
          sessionId: selectedSessionId || undefined,
        }),
      });
      const data = await res.json();
      if (data.sessionId) setSelectedSessionId(data.sessionId);

      const qs = new URLSearchParams({ agentId: selectedAgentId });
      if (data.sessionId || selectedSessionId) qs.set("sessionId", data.sessionId || selectedSessionId);
      const m = await fetch(`/api/openclaw/messages?${qs.toString()}`).then((r) => r.json());
      setMessages(m.messages || []);
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="p-8">Loading agents...</div>;

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
        <Users className="inline-block w-8 h-8 mr-2 mb-1" /> Agents
      </h1>

      <div className="flex gap-2 mb-6 border-b" style={{ borderColor: "var(--border)" }}>
        {[
          { id: "cards" as const, label: "Agent Cards" },
          { id: "organigrama" as const, label: "Organigrama" },
          { id: "chat" as const, label: "Agent Chat" },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="px-4 py-2" style={{ color: activeTab === tab.id ? "var(--accent)" : "var(--text-secondary)" }}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "organigrama" && <AgentOrganigrama agents={agents as any} />}

      {activeTab === "cards" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {agents.map((agent) => (
            <div key={agent.id} className="rounded-xl p-4" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{agent.emoji}</div>
                  <div>
                    <div className="font-bold" style={{ color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                      {agent.name}
                      {agent.isOrchestrator && (
                        <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 999, background: "rgba(255,59,48,0.15)", color: "var(--accent)", border: "1px solid var(--border)" }}>
                          ORCHESTRATOR
                        </span>
                      )}
                    </div>
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>{agent.model}</div>
                    <div className="text-xs" style={{ color: "var(--text-secondary)", marginTop: 2 }}>State: {agent.currentState}</div>
                  </div>
                </div>
                <Circle className="w-2 h-2" style={{ fill: agent.status === "online" ? "#4ade80" : "#6b7280", color: agent.status === "online" ? "#4ade80" : "#6b7280" }} />
              </div>
              <div className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
                Last activity: {formatLastActivity(agent.lastActivity)} · {agent.activeSessions} sessions
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "chat" && (
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 md:col-span-3 rounded-xl p-3" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="text-sm mb-2" style={{ color: "var(--text-muted)" }}>Agents</div>
            <div className="space-y-2">
              {agents.map((a) => (
                <button
                  key={a.id}
                  onClick={() => { setSelectedAgentId(a.id); setSelectedSessionId(""); }}
                  className="w-full text-left px-3 py-2 rounded-lg"
                  style={{ backgroundColor: selectedAgentId === a.id ? "var(--card-elevated)" : "transparent", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                >
                  {a.emoji} {a.name}
                </button>
              ))}
            </div>

            <div className="text-sm mt-4 mb-2" style={{ color: "var(--text-muted)" }}>Sessions</div>
            <div className="space-y-2 max-h-56 overflow-auto">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSessionId(s.sessionId || "")}
                  className="w-full text-left px-2 py-1 rounded"
                  style={{ color: "var(--text-secondary)", backgroundColor: selectedSessionId === s.sessionId ? "var(--card-elevated)" : "transparent" }}
                >
                  {s.sessionId?.slice(0, 8) || "no-file"}…
                </button>
              ))}
            </div>
          </div>

          <div className="col-span-12 md:col-span-9 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", minHeight: 520 }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
              <Bot className="inline-block w-4 h-4 mr-2" />
              {selectedAgent ? `${selectedAgent.emoji} ${selectedAgent.name}` : "Select an agent"}
            </div>

            <div className="flex-1 p-4 overflow-auto space-y-3">
              {messages.map((m) => (
                <div key={m.id} style={{ textAlign: m.type === "user" ? "right" : "left" }}>
                  <div
                    style={{
                      display: "inline-block",
                      maxWidth: "80%",
                      padding: "8px 10px",
                      borderRadius: 12,
                      backgroundColor: m.type === "user" ? "rgba(255,59,48,0.15)" : "var(--card-elevated)",
                      border: "1px solid var(--border)",
                      color: "var(--text-primary)",
                      whiteSpace: "pre-wrap",
                      fontSize: 13,
                    }}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {messages.length === 0 && <div style={{ color: "var(--text-muted)" }}>No messages yet.</div>}
            </div>

            <div className="p-3 border-t" style={{ borderColor: "var(--border)", display: "flex", gap: 8 }}>
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={selectedAgentId ? `Message ${selectedAgent?.name || "agent"}...` : "Select an agent"}
                className="flex-1 px-3 py-2 rounded-lg"
                style={{ backgroundColor: "var(--card-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
              />
              <button onClick={sendMessage} disabled={!selectedAgentId || !prompt.trim() || sending} className="px-3 py-2 rounded-lg" style={{ backgroundColor: "var(--accent)", color: "black" }}>
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
