"use client";

import { useEffect, useState } from "react";
import {
  Bot,
  Circle,
  MessageSquare,
  HardDrive,
  Shield,
  Users,
  Activity,
  GitBranch,
  LayoutGrid,
} from "lucide-react";
import { AgentOrganigrama } from "@/components/AgentOrganigrama";

interface Agent {
  id: string;
  name: string;
  emoji: string;
  color: string;
  model: string;
  workspace: string;
  dmPolicy?: string;
  currentTask?: string;
  isActive?: boolean;
  role?: string;
  allowAgents: string[];
  allowAgentsDetails?: Array<{
    id: string;
    name: string;
    emoji: string;
    color: string;
  }>;
  botToken?: string;
  status: "online" | "offline";
  lastActivity?: string;
  activeSessions: number;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [activeTab, setActiveTab] = useState<"cards" | "orgChart">("cards");

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchAgents = async () => {
    try {
      const [agentsRes, officeRes] = await Promise.all([
        fetch("/api/agents", { cache: "no-store" }),
        fetch("/api/office", { cache: "no-store" }),
      ]);

      const [agentsData, officeData] = await Promise.all([
        agentsRes.json(),
        officeRes.json().catch(() => ({ agents: [] })),
      ]);

      const officeById = new Map<string, { currentTask?: string; isActive?: boolean; role?: string }>(
        (officeData?.agents || []).map((a: { id: string; currentTask?: string; isActive?: boolean; role?: string }) => [a.id, a])
      );

      const merged = (agentsData?.agents || []).map((agent: Agent) => {
        const office = officeById.get(agent.id);
        return {
          ...agent,
          currentTask: office?.currentTask ?? agent.currentTask,
          isActive: office?.isActive ?? agent.isActive,
          role: office?.role ?? agent.role,
          status: office?.isActive ? "online" : agent.status,
        } as Agent;
      });

      setAgents(merged);
      setHasLoadedOnce(true);
    } catch (error) {
      console.error("Error fetching agents:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatLastActivity = (timestamp?: string) => {
    if (!timestamp) return "Never";
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // Render static shell immediately; avoid full-page loading spinners.

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-3xl font-bold mb-2"
          style={{
            fontFamily: "var(--font-heading)",
            color: "var(--text-primary)",
            letterSpacing: "-1.5px",
          }}
        >
          <Users className="inline-block w-8 h-8 mr-2 mb-1" />
          Agents
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
          Multi-agent system overview • {agents.length} agents configured
          {loading && !hasLoadedOnce ? " • loading…" : ""}
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-6 border-b" style={{ borderColor: "var(--border)" }}>
        {[
          { id: "cards" as const, label: "Agent Cards", icon: LayoutGrid },
          { id: "orgChart" as const, label: "Org Chart", icon: GitBranch },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="flex items-center gap-2 px-4 py-2 font-medium transition-all"
            style={{
              color: activeTab === id ? "var(--accent)" : "var(--text-secondary)",
              borderBottom: activeTab === id ? "2px solid var(--accent)" : "2px solid transparent",
              background: "none", border: "none", cursor: "pointer",
              borderBottomStyle: "solid",
              borderBottomWidth: "2px",
              borderBottomColor: activeTab === id ? "var(--accent)" : "transparent",
              paddingBottom: "0.5rem",
            }}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Organigrama View */}
      {activeTab === "orgChart" && (
        <div className="rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>Agent Hierarchy</h2>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Visualization of agent communication allowances</p>
          </div>
          <AgentOrganigrama agents={agents} />
        </div>
      )}

      {/* Agents Grid */}
      {activeTab === "cards" && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {agents.length === 0 && loading && !hasLoadedOnce && (
          <>
            {[0, 1].map((index) => (
              <div
                key={`placeholder-${index}`}
                className="rounded-xl overflow-hidden"
                style={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                }}
              >
                <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
                  <div className="h-6 w-40 rounded" style={{ backgroundColor: "var(--border)" }} />
                </div>
                <div className="p-5 space-y-3">
                  <div className="h-4 w-full rounded" style={{ backgroundColor: "var(--border)" }} />
                  <div className="h-4 w-4/5 rounded" style={{ backgroundColor: "var(--border)" }} />
                  <div className="h-4 w-3/5 rounded" style={{ backgroundColor: "var(--border)" }} />
                </div>
              </div>
            ))}
          </>
        )}

        {agents.map((agent) => (
          <div
            key={agent.id}
            className="rounded-xl overflow-hidden transition-all hover:scale-[1.02]"
            style={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
            }}
          >
            {/* Header with status */}
            <div
              className="px-5 py-4 flex items-center justify-between"
              style={{
                borderBottom: "1px solid var(--border)",
                background: `linear-gradient(135deg, ${agent.color}15, transparent)`,
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                  style={{
                    backgroundColor: `${agent.color}20`,
                    border: `2px solid ${agent.color}`,
                  }}
                >
                  {agent.emoji}
                </div>
                <div>
                  <h3
                    className="text-lg font-bold"
                    style={{
                      fontFamily: "var(--font-heading)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {agent.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Circle
                      className="w-2 h-2"
                      style={{
                        fill: agent.status === "online" ? "#4ade80" : "#6b7280",
                        color: agent.status === "online" ? "#4ade80" : "#6b7280",
                      }}
                    />
                    <span
                      className="text-xs font-medium"
                      style={{
                        color:
                          agent.status === "online"
                            ? "#4ade80"
                            : "var(--text-muted)",
                      }}
                    >
                      {agent.status}
                    </span>
                  </div>
                </div>
              </div>

              {agent.botToken && (
                <div title="Telegram Bot Connected">
                  <MessageSquare
                    className="w-5 h-5"
                    style={{ color: "#0088cc" }}
                  />
                </div>
              )}
            </div>

            {/* Details */}
            <div className="p-5 space-y-4">
              {/* Model */}
              <div className="flex items-start gap-3">
                <Bot className="w-4 h-4 mt-0.5" style={{ color: agent.color }} />
                <div className="flex-1 min-w-0">
                  <div
                    className="text-xs font-medium mb-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Model
                  </div>
                  <div
                    className="text-sm font-mono truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {agent.model}
                  </div>
                </div>
              </div>

              {/* Workspace */}
              <div className="flex items-start gap-3">
                <HardDrive
                  className="w-4 h-4 mt-0.5"
                  style={{ color: agent.color }}
                />
                <div className="flex-1 min-w-0">
                  <div
                    className="text-xs font-medium mb-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Workspace
                  </div>
                  <div
                    className="text-sm font-mono truncate"
                    style={{ color: "var(--text-primary)" }}
                    title={agent.workspace}
                  >
                    {agent.workspace}
                  </div>
                </div>
              </div>

              {/* DM Policy */}
              {agent.dmPolicy && (
                <div className="flex items-start gap-3">
                  <Shield
                    className="w-4 h-4 mt-0.5"
                    style={{ color: agent.color }}
                  />
                  <div className="flex-1">
                    <div
                      className="text-xs font-medium mb-1"
                      style={{ color: "var(--text-muted)" }}
                    >
                      DM Policy
                    </div>
                    <div
                      className="text-sm font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {agent.dmPolicy}
                    </div>
                  </div>
                </div>
              )}

              {/* Subagents */}
              {agent.allowAgents.length > 0 && (
                <div className="flex items-start gap-3">
                  <Users
                    className="w-4 h-4 mt-0.5"
                    style={{ color: agent.color }}
                  />
                  <div className="flex-1">
                    <div
                      className="text-xs font-medium mb-2"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Can spawn subagents ({agent.allowAgents.length})
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {agent.allowAgentsDetails && agent.allowAgentsDetails.length > 0 ? (
                        agent.allowAgentsDetails.map((subagent) => (
                          <div
                            key={subagent.id}
                            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all hover:scale-105"
                            style={{
                              backgroundColor: `${subagent.color}15`,
                              border: `1px solid ${subagent.color}40`,
                            }}
                            title={`${subagent.name} (${subagent.id})`}
                          >
                            <span className="text-sm">{subagent.emoji}</span>
                            <span
                              style={{
                                color: subagent.color,
                                fontWeight: 600,
                              }}
                            >
                              {subagent.name}
                            </span>
                          </div>
                        ))
                      ) : (
                        agent.allowAgents.map((subagent) => (
                          <span
                            key={subagent}
                            className="text-xs px-2 py-1 rounded"
                            style={{
                              backgroundColor: `${agent.color}20`,
                              color: agent.color,
                              fontWeight: 500,
                            }}
                          >
                            {subagent}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Current task / runtime state (from Office state) */}
              {(agent.currentTask || agent.role) && (
                <div className="flex items-start gap-3">
                  <Activity className="w-4 h-4 mt-0.5" style={{ color: agent.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
                      Runtime State
                    </div>
                    {agent.role && (
                      <div className="text-xs" style={{ color: "var(--text-secondary)", marginBottom: "0.2rem" }}>
                        Role: {agent.role}
                      </div>
                    )}
                    {agent.currentTask && (
                      <div
                        className="text-sm"
                        style={{ color: "var(--text-primary)", lineHeight: 1.4 }}
                        title={agent.currentTask}
                      >
                        {agent.currentTask}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Last Activity */}
              <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Last activity: {formatLastActivity(agent.lastActivity)}
                  </span>
                </div>
                {agent.activeSessions > 0 && (
                  <span
                    className="text-xs font-medium px-2 py-1 rounded"
                    style={{
                      backgroundColor: "var(--success)20",
                      color: "var(--success)",
                    }}
                  >
                    {agent.activeSessions} active
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {!loading && agents.length === 0 && (
          <div
            className="rounded-xl p-6"
            style={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
            }}
          >
            No agents found.
          </div>
        )}
      </div>
      )}
    </div>
  );
}
