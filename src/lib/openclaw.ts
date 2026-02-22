import { execFileSync } from "child_process";
import { existsSync, readFileSync, statSync } from "fs";
import path from "path";

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || "/root/.openclaw";
const OPENCLAW_CONFIG = path.join(OPENCLAW_DIR, "openclaw.json");

export interface OpenclawAgent {
  id: string;
  name: string;
  emoji: string;
  color: string;
  model: string;
  workspace: string;
  allowAgents: string[];
  status: "online" | "offline";
  currentState: "ACTIVE" | "IDLE" | "SLEEPING";
  isOrchestrator: boolean;
  lastActivity?: string;
  activeSessions: number;
}

interface RawSession {
  key: string;
  updatedAt: number;
  ageMs: number;
  sessionId?: string;
  model?: string;
  modelProvider?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  totalTokensFresh?: boolean;
  contextTokens?: number;
  abortedLastRun?: boolean;
}

export interface AgentSession {
  id: string;
  key: string;
  sessionId: string | null;
  updatedAt: number;
  ageMs: number;
  model: string;
  modelProvider: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  contextTokens: number;
  contextUsedPercent: number | null;
  aborted: boolean;
}

export interface SessionMessage {
  id: string;
  type: "user" | "assistant" | "tool_use" | "tool_result" | "system";
  role?: string;
  content: string;
  timestamp: string;
  model?: string;
  toolName?: string;
}

export function runOpenclawJson(args: string[]): any {
  const output = execFileSync("openclaw", [...args, "--json"], {
    encoding: "utf-8",
    timeout: 15000,
  });
  return JSON.parse(output);
}

function getAgentDisplayInfo(agentId: string, agentConfig: any): { emoji: string; color: string; name: string } {
  const defaultInfo = agentId === "main"
    ? {
        emoji: process.env.NEXT_PUBLIC_AGENT_EMOJI || "🤖",
        color: "#ff6b35",
        name: process.env.NEXT_PUBLIC_AGENT_NAME || "Mission Control",
      }
    : { emoji: "🤖", color: "#666666", name: agentId };

  return {
    emoji: agentConfig?.ui?.emoji || defaultInfo.emoji,
    color: agentConfig?.ui?.color || defaultInfo.color,
    name: agentConfig?.name || defaultInfo.name,
  };
}

function resolveWorkspace(agent: any): string {
  if (typeof agent?.workspace === "string" && agent.workspace.length > 0) {
    return agent.workspace;
  }

  const candidates = [
    path.join(OPENCLAW_DIR, `workspace-${agent.id}`),
    path.join(OPENCLAW_DIR, "workspace", agent.id),
    path.join(OPENCLAW_DIR, "workspace"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return path.join(OPENCLAW_DIR, "workspace");
}

export function getAgents(): OpenclawAgent[] {
  const config = JSON.parse(readFileSync(OPENCLAW_CONFIG, "utf-8"));
  const sessions = getAgentSessionsById();

  return (config.agents?.list || []).map((agent: any) => {
    const info = getAgentDisplayInfo(agent.id, agent);
    const workspace = resolveWorkspace(agent);
    const memoryFile = path.join(workspace, "memory", `${new Date().toISOString().split("T")[0]}.md`);

    let status: "online" | "offline" = "offline";
    let currentState: "ACTIVE" | "IDLE" | "SLEEPING" = "SLEEPING";
    let lastActivity: string | undefined;

    if (existsSync(memoryFile)) {
      const st = statSync(memoryFile);
      lastActivity = st.mtime.toISOString();
      const deltaMs = Date.now() - st.mtime.getTime();
      status = deltaMs < 5 * 60 * 1000 ? "online" : "offline";
      if (deltaMs < 5 * 60 * 1000) currentState = "ACTIVE";
      else if (deltaMs < 30 * 60 * 1000) currentState = "IDLE";
      else currentState = "SLEEPING";
    }

    const allowAgents = Array.isArray(agent?.subagents?.allowAgents) ? agent.subagents.allowAgents : [];
    const activeSessions = (sessions[agent.id] || []).length;
    const isOrchestrator = allowAgents.length > 0;

    return {
      id: agent.id,
      name: agent.name || info.name,
      emoji: agent.identity?.emoji || info.emoji,
      color: info.color,
      model: agent.model?.primary || config.agents?.defaults?.model?.primary || "unknown",
      workspace,
      allowAgents,
      status,
      currentState,
      isOrchestrator,
      lastActivity,
      activeSessions,
    } satisfies OpenclawAgent;
  });
}

function getAgentSessionsById(): Record<string, AgentSession[]> {
  let rawSessions: RawSession[] = [];
  try {
    let payload: any;
    try {
      payload = runOpenclawJson(["sessions", "list"]);
    } catch {
      payload = runOpenclawJson(["sessions"]);
    }
    rawSessions = payload.sessions || [];
  } catch {
    return {};
  }

  const grouped: Record<string, AgentSession[]> = {};

  for (const s of rawSessions) {
    const parts = s.key.split(":");
    if (parts.length < 3 || parts[0] !== "agent") continue;
    if (parts.includes("run")) continue;

    const agentId = parts[1];
    const totalTokens = s.totalTokens || 0;
    const contextTokens = s.contextTokens || 0;

    const parsed: AgentSession = {
      id: s.key,
      key: s.key,
      sessionId: s.sessionId || null,
      updatedAt: s.updatedAt,
      ageMs: s.ageMs,
      model: s.model || "unknown",
      modelProvider: s.modelProvider || "unknown",
      inputTokens: s.inputTokens || 0,
      outputTokens: s.outputTokens || 0,
      totalTokens,
      contextTokens,
      contextUsedPercent: contextTokens > 0 && s.totalTokensFresh ? Math.round((totalTokens / contextTokens) * 100) : null,
      aborted: s.abortedLastRun || false,
    };

    if (!grouped[agentId]) grouped[agentId] = [];
    grouped[agentId].push(parsed);
  }

  for (const agentId of Object.keys(grouped)) {
    grouped[agentId].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  return grouped;
}

export function getSessions(agentId: string): AgentSession[] {
  return getAgentSessionsById()[agentId] || [];
}

export function getSessionMessages(agentId: string, sessionId?: string): { sessionId: string | null; messages: SessionMessage[] } {
  let resolvedSessionId = sessionId || null;

  if (!resolvedSessionId) {
    const latest = getSessions(agentId).find((s) => s.sessionId);
    resolvedSessionId = latest?.sessionId || null;
  }

  if (!resolvedSessionId) {
    return { sessionId: null, messages: [] };
  }

  if (!/^[a-f0-9-]{36}$/.test(resolvedSessionId)) {
    throw new Error("Invalid session ID");
  }

  const filePath = path.join(OPENCLAW_DIR, "agents", agentId, "sessions", `${resolvedSessionId}.jsonl`);
  if (!existsSync(filePath)) {
    return { sessionId: resolvedSessionId, messages: [] };
  }

  const lines = readFileSync(filePath, "utf-8").trim().split("\n").filter(Boolean);
  const messages: SessionMessage[] = [];
  let currentModel = "";

  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.type === "model_change" && obj.modelId) currentModel = obj.modelId;
      if (obj.type !== "message" || !obj.message) continue;

      const msg = obj.message;
      const role = msg.role;
      const timestamp = obj.timestamp || new Date().toISOString();

      if (typeof msg.content === "string") {
        messages.push({
          id: obj.id || Math.random().toString(),
          type: role === "user" ? "user" : "assistant",
          role,
          content: msg.content,
          timestamp,
          model: currentModel || undefined,
        });
      } else if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === "text" && block.text) {
            messages.push({
              id: `${obj.id || "msg"}-text`,
              type: role === "user" ? "user" : "assistant",
              role,
              content: block.text,
              timestamp,
              model: currentModel || undefined,
            });
          } else if (block.type === "tool_use" && block.name) {
            messages.push({
              id: block.id || `${obj.id || "msg"}-tool`,
              type: "tool_use",
              role,
              content: `${block.name}(${block.input ? JSON.stringify(block.input).slice(0, 200) : ""})`,
              timestamp,
              toolName: block.name,
              model: currentModel || undefined,
            });
          } else if (block.type === "tool_result") {
            messages.push({
              id: `${obj.id || "msg"}-result`,
              type: "tool_result",
              role,
              content: typeof block.text === "string" ? block.text.slice(0, 500) : "",
              timestamp,
              model: currentModel || undefined,
            });
          }
        }
      }
    } catch {
      // skip malformed
    }
  }

  return { sessionId: resolvedSessionId, messages };
}

export function sendAgentMessage(agentId: string, message: string, sessionId?: string): { output: string; sessionId?: string } {
  const args = ["agent", "--agent", agentId, "--message", message, "--local", "--json"];
  if (sessionId) args.push("--session-id", sessionId);

  const raw = execFileSync("openclaw", args, {
    encoding: "utf-8",
    timeout: 60000,
    maxBuffer: 8 * 1024 * 1024,
  });

  const parsed = JSON.parse(raw);
  const payloads = Array.isArray(parsed.payloads) ? parsed.payloads : [];
  const output = payloads
    .filter((p: any) => typeof p?.text === "string")
    .map((p: any) => p.text)
    .join("\n\n")
    .trim();

  return {
    output,
    sessionId: parsed?.sessionId,
  };
}
