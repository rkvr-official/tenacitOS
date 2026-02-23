import { execFileSync } from "child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
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

const _openclawCache = new Map<string, { expiresAt: number; value: any }>();

export function runOpenclawJson(args: string[]): any {
  // Micro-cache to avoid hammering the CLI during hydration bursts (Office/Agents/System panels).
  // This reduces latency + prevents event-loop stalls from multiple back-to-back execFileSync calls.
  const key = JSON.stringify(args);
  const now = Date.now();
  const cached = _openclawCache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;

  const output = execFileSync("openclaw", [...args, "--json"], {
    encoding: "utf-8",
    timeout: 15000,
  });
  const value = JSON.parse(output);
  _openclawCache.set(key, { expiresAt: now + 1500, value });
  return value;
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
  const grouped: Record<string, AgentSession[]> = {};

  const push = (agentId: string, s: AgentSession) => {
    if (!grouped[agentId]) grouped[agentId] = [];
    grouped[agentId].push(s);
  };

  // Primary: CLI sessions list (live usage)
  let rawSessions: RawSession[] = [];
  try {
    let payload: any;
    try {
      payload = runOpenclawJson(["sessions", "list"]);
    } catch {
      payload = runOpenclawJson(["sessions"]);
    }
    rawSessions = Array.isArray(payload?.sessions) ? payload.sessions : [];
  } catch {
    rawSessions = [];
  }

  for (const s of rawSessions) {
    const parts = String(s.key || "").split(":");
    if (parts.length < 3 || parts[0] !== "agent") continue;
    if (parts.includes("run")) continue;

    const agentId = parts[1];
    const totalTokens = s.totalTokens || 0;
    const contextTokens = s.contextTokens || 0;

    push(agentId, {
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
    });
  }

  // Fallback/enrichment: session stores on disk (works even when CLI list is empty)
  try {
    const agentsRoot = path.join(OPENCLAW_DIR, "agents");
    const agentDirs = existsSync(agentsRoot) ? readdirSync(agentsRoot, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [];

    for (const agentId of agentDirs) {
      const storePath = path.join(agentsRoot, agentId, "sessions", "sessions.json");
      if (!existsSync(storePath)) continue;

      try {
        const store = JSON.parse(readFileSync(storePath, "utf-8"));
        for (const [key, meta] of Object.entries(store as Record<string, any>)) {
          if (!String(key).startsWith("agent:")) continue;
          if (String(key).includes(":run:")) continue;

          const updatedAt = Number(meta?.updatedAt || 0);
          const totalTokens = Number(meta?.totalTokens || 0);
          const contextTokens = Number(meta?.contextTokens || 0);
          const entry: AgentSession = {
            id: String(key),
            key: String(key),
            sessionId: typeof meta?.sessionId === "string" ? meta.sessionId : null,
            updatedAt,
            ageMs: updatedAt > 0 ? Date.now() - updatedAt : 0,
            model: typeof meta?.model === "string" ? meta.model : "unknown",
            modelProvider: typeof meta?.modelProvider === "string" ? meta.modelProvider : "unknown",
            inputTokens: Number(meta?.inputTokens || 0),
            outputTokens: Number(meta?.outputTokens || 0),
            totalTokens,
            contextTokens,
            contextUsedPercent: contextTokens > 0 ? Math.round((totalTokens / contextTokens) * 100) : null,
            aborted: !!meta?.abortedLastRun,
          };

          const existing = grouped[agentId]?.find((x) => x.key === entry.key);
          if (!existing) push(agentId, entry);
        }
      } catch {
        // ignore malformed store
      }
    }
  } catch {
    // ignore fallback errors
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

  if (!/^[a-z0-9-]{36}$/i.test(resolvedSessionId)) {
    throw new Error("Invalid session ID");
  }

  const sessionsDir = path.join(OPENCLAW_DIR, "agents", agentId, "sessions");

  // 1) resolve via sessions.json metadata (supports topic-suffixed files)
  let filePath: string | null = null;
  const storePath = path.join(sessionsDir, "sessions.json");
  if (existsSync(storePath)) {
    try {
      const store = JSON.parse(readFileSync(storePath, "utf-8"));
      for (const entry of Object.values(store as Record<string, any>)) {
        if (entry?.sessionId === resolvedSessionId && typeof entry?.sessionFile === "string") {
          filePath = entry.sessionFile;
          break;
        }
      }
    } catch {
      // ignore malformed store
    }
  }

  // 2) direct file fallback
  if (!filePath) {
    const direct = path.join(sessionsDir, `${resolvedSessionId}.jsonl`);
    if (existsSync(direct)) filePath = direct;
  }

  // 3) topic file fallback
  if (!filePath) {
    try {
      const files = readdirSync(sessionsDir);
      const topic = files.find((f) => f.startsWith(`${resolvedSessionId}-topic-`) && f.endsWith(".jsonl"));
      if (topic) filePath = path.join(sessionsDir, topic);
    } catch {
      // ignore
    }
  }

  if (!filePath || !existsSync(filePath)) {
    return { sessionId: resolvedSessionId, messages: [] };
  }

  const lines = readFileSync(filePath, "utf-8").trim().split("\n").filter(Boolean);
  const messages: SessionMessage[] = [];
  let currentModel = "";

  const asText = (v: unknown): string => {
    if (typeof v === "string") return v;
    if (Array.isArray(v)) return v.map(asText).filter(Boolean).join("\n");
    if (v && typeof v === "object") {
      const obj = v as Record<string, unknown>;
      if (typeof obj.text === "string") return obj.text;
      if (typeof obj.content === "string") return obj.content;
      if (Array.isArray(obj.content)) return asText(obj.content);
      return JSON.stringify(obj);
    }
    return "";
  };

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
              id: `${obj.id || "msg"}-text-${messages.length}`,
              type: role === "user" ? "user" : "assistant",
              role,
              content: String(block.text),
              timestamp,
              model: currentModel || undefined,
            });
          } else if (block.type === "tool_use" && block.name) {
            messages.push({
              id: block.id || `${obj.id || "msg"}-tool-${messages.length}`,
              type: "tool_use",
              role,
              content: `${block.name}(${block.input ? JSON.stringify(block.input).slice(0, 220) : ""})`,
              timestamp,
              toolName: block.name,
              model: currentModel || undefined,
            });
          } else if (block.type === "tool_result") {
            messages.push({
              id: `${obj.id || "msg"}-result-${messages.length}`,
              type: "tool_result",
              role,
              content: asText(block.text ?? block.content ?? "").slice(0, 1200),
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
