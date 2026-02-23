/**
 * Sessions API
 * GET /api/sessions                          → list sessions across all agents
 * GET /api/sessions?id=<sessionId>[&agentId][&key]
 *                                          → get message history for one session
 */
import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || "/root/.openclaw";

type SessionType = "main" | "cron" | "subagent" | "direct" | "unknown";

interface ParsedSession {
  id: string;
  key: string;
  agentId: string;
  type: SessionType;
  typeLabel: string;
  typeEmoji: string;
  sessionId: string | null;
  sessionFile: string | null;
  cronJobId?: string;
  subagentId?: string;
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

function parseSessionKey(key: string): {
  type: SessionType;
  typeLabel: string;
  typeEmoji: string;
  cronJobId?: string;
  subagentId?: string;
  isRunEntry: boolean;
  agentId: string;
} {
  const parts = key.split(":");
  const agentId = parts[1] || "main";

  if (parts.includes("run")) {
    return { type: "unknown", typeLabel: "Run Entry", typeEmoji: "🔁", isRunEntry: true, agentId };
  }

  if (parts[2] === "main") {
    return { type: "main", typeLabel: "Main Session", typeEmoji: "🦞", isRunEntry: false, agentId };
  }

  if (parts[2] === "cron") {
    return {
      type: "cron",
      typeLabel: "Cron Job",
      typeEmoji: "🕐",
      cronJobId: parts[3],
      isRunEntry: false,
      agentId,
    };
  }

  if (parts[2] === "subagent") {
    return {
      type: "subagent",
      typeLabel: "Sub-agent",
      typeEmoji: "🤖",
      subagentId: parts[3],
      isRunEntry: false,
      agentId,
    };
  }

  return {
    type: "direct",
    typeLabel: parts[2] ? `${parts[2].charAt(0).toUpperCase() + parts[2].slice(1)} Chat` : "Direct Chat",
    typeEmoji: "💬",
    isRunEntry: false,
    agentId,
  };
}

function loadCliSessionUsage(): Map<string, any> {
  const byKey = new Map<string, any>();
  try {
    const output = execSync("openclaw sessions list --json 2>/dev/null", {
      timeout: 10000,
      encoding: "utf-8",
    });
    const data = JSON.parse(output);
    const rows = Array.isArray(data?.sessions) ? data.sessions : [];
    for (const row of rows) {
      if (typeof row?.key === "string") byKey.set(row.key, row);
    }
  } catch {
    // best-effort enrichment only
  }
  return byKey;
}

function listAgentStores(): string[] {
  const agentsRoot = join(OPENCLAW_DIR, "agents");
  if (!existsSync(agentsRoot)) return [];
  try {
    return readdirSync(agentsRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }
}

function parseSessionsFromStore(agentId: string): ParsedSession[] {
  const sessionsPath = join(OPENCLAW_DIR, "agents", agentId, "sessions", "sessions.json");
  if (!existsSync(sessionsPath)) return [];

  try {
    const raw = JSON.parse(readFileSync(sessionsPath, "utf-8"));
    if (!raw || typeof raw !== "object") return [];

    const out: ParsedSession[] = [];

    for (const [key, meta] of Object.entries(raw as Record<string, any>)) {
      const parsed = parseSessionKey(key);
      if (parsed.isRunEntry || parsed.type === "unknown") continue;

      const totalTokens = Number(meta?.totalTokens || 0);
      const contextTokens = Number(meta?.contextTokens || 0);
      const contextUsedPercent =
        contextTokens > 0 ? Math.round((totalTokens / contextTokens) * 100) : null;

      out.push({
        id: key,
        key,
        agentId: parsed.agentId || agentId,
        type: parsed.type,
        typeLabel: parsed.typeLabel,
        typeEmoji: parsed.typeEmoji,
        sessionId: typeof meta?.sessionId === "string" ? meta.sessionId : null,
        sessionFile: typeof meta?.sessionFile === "string" ? meta.sessionFile : null,
        cronJobId: parsed.cronJobId,
        subagentId: parsed.subagentId,
        updatedAt: Number(meta?.updatedAt || 0),
        ageMs: Number(meta?.updatedAt ? Date.now() - Number(meta.updatedAt) : 0),
        model: typeof meta?.model === "string" ? meta.model : "unknown",
        modelProvider: typeof meta?.modelProvider === "string" ? meta.modelProvider : "unknown",
        inputTokens: Number(meta?.inputTokens || 0),
        outputTokens: Number(meta?.outputTokens || 0),
        totalTokens,
        contextTokens,
        contextUsedPercent,
        aborted: !!meta?.abortedLastRun,
      });
    }

    return out;
  } catch {
    return [];
  }
}

async function listSessions(): Promise<NextResponse> {
  try {
    const cliUsage = loadCliSessionUsage();

    const all: ParsedSession[] = [];
    for (const agentId of listAgentStores()) {
      all.push(...parseSessionsFromStore(agentId));
    }

    // Enrich from CLI usage when key matches
    for (const s of all) {
      const cli = cliUsage.get(s.key);
      if (!cli) continue;
      s.updatedAt = Number(cli.updatedAt || s.updatedAt);
      s.ageMs = Number(cli.ageMs ?? s.ageMs);
      s.model = cli.model || s.model;
      s.modelProvider = cli.modelProvider || s.modelProvider;
      s.inputTokens = Number(cli.inputTokens ?? s.inputTokens);
      s.outputTokens = Number(cli.outputTokens ?? s.outputTokens);
      s.totalTokens = Number(cli.totalTokens ?? s.totalTokens);
      s.contextTokens = Number(cli.contextTokens ?? s.contextTokens);
      s.contextUsedPercent =
        s.contextTokens > 0 && cli.totalTokensFresh
          ? Math.round((s.totalTokens / s.contextTokens) * 100)
          : s.contextUsedPercent;
      s.aborted = Boolean(cli.abortedLastRun ?? s.aborted);
      if (!s.sessionId && typeof cli.sessionId === "string") s.sessionId = cli.sessionId;
    }

    // De-duplicate by key
    const dedup = new Map<string, ParsedSession>();
    for (const s of all) {
      const prev = dedup.get(s.key);
      if (!prev || s.updatedAt > prev.updatedAt) dedup.set(s.key, s);
    }

    const sessions = Array.from(dedup.values()).sort((a, b) => b.updatedAt - a.updatedAt);
    return NextResponse.json({ sessions, total: sessions.length });
  } catch (error) {
    console.error("[sessions] Error listing sessions:", error);
    return NextResponse.json({ error: "Failed to list sessions", sessions: [] }, { status: 500 });
  }
}

function safeSessionId(id: string): boolean {
  // UUID + optional topic suffix emitted by OpenClaw stores
  return /^[a-z0-9-]{36}(?:-topic-[0-9.]+)?$/i.test(id);
}

function getSessionFileFromStore(sessionId: string, agentId?: string, key?: string): string | null {
  const agents = agentId ? [agentId] : listAgentStores();

  for (const aid of agents) {
    const storePath = join(OPENCLAW_DIR, "agents", aid, "sessions", "sessions.json");
    if (!existsSync(storePath)) continue;
    try {
      const store = JSON.parse(readFileSync(storePath, "utf-8"));
      if (!store || typeof store !== "object") continue;

      if (key && typeof store[key]?.sessionFile === "string") {
        return store[key].sessionFile;
      }

      for (const entry of Object.values(store as Record<string, any>)) {
        if (entry?.sessionId === sessionId && typeof entry?.sessionFile === "string") {
          return entry.sessionFile;
        }
      }
    } catch {
      // ignore malformed store
    }
  }

  return null;
}

function resolveSessionFilePath(sessionId: string, agentId?: string, key?: string): string | null {
  // 1) direct from sessions store metadata
  const fromStore = getSessionFileFromStore(sessionId, agentId, key);
  if (fromStore && existsSync(fromStore)) return fromStore;

  // 2) exact filename under agent(s)
  const agents = agentId ? [agentId] : listAgentStores();
  for (const aid of agents) {
    const sessionsDir = join(OPENCLAW_DIR, "agents", aid, "sessions");
    const exact = join(sessionsDir, `${sessionId}.jsonl`);
    if (existsSync(exact)) return exact;

    // 3) topic-suffixed fallback
    try {
      const files = readdirSync(sessionsDir);
      const topic = files.find((f) => f.startsWith(`${sessionId}-topic-`) && f.endsWith(".jsonl"));
      if (topic) return join(sessionsDir, topic);
    } catch {
      // ignore
    }
  }

  return null;
}

function readSessionMessages(filePath: string) {
  interface ParsedMessage {
    id: string;
    type: "user" | "assistant" | "tool_use" | "tool_result" | "model_change" | "system";
    role?: string;
    content: string;
    timestamp: string;
    model?: string;
    toolName?: string;
  }

  const raw = readFileSync(filePath, "utf-8");
  const lines = raw.trim().split("\n").filter(Boolean);
  const messages: ParsedMessage[] = [];
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
      const obj: any = JSON.parse(line);

      if (obj.type === "model_change" && obj.modelId) {
        currentModel = String(obj.modelId);
      }

      if (obj.type !== "message" || !obj.message) continue;

      const msg = obj.message;
      const role = msg.role;
      const timestamp = obj.timestamp || new Date().toISOString();

      if (typeof msg.content === "string") {
        messages.push({
          id: obj.id || Math.random().toString(36).slice(2),
          type: role === "user" ? "user" : "assistant",
          role,
          content: msg.content,
          timestamp,
          model: currentModel || undefined,
        });
        continue;
      }

      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block?.type === "text" && block?.text) {
            messages.push({
              id: `${obj.id || "msg"}-text-${messages.length}`,
              type: role === "user" ? "user" : "assistant",
              role,
              content: String(block.text),
              timestamp,
              model: currentModel || undefined,
            });
          } else if (block?.type === "tool_use" && block?.name) {
            messages.push({
              id: block.id || `${obj.id || "msg"}-tool-${messages.length}`,
              type: "tool_use",
              role,
              content: `${block.name}(${block.input ? JSON.stringify(block.input).slice(0, 320) : ""})`,
              timestamp,
              toolName: String(block.name),
              model: currentModel || undefined,
            });
          } else if (block?.type === "tool_result") {
            const txt = asText(block.text ?? block.content ?? "").slice(0, 1200);
            messages.push({
              id: `${obj.id || "msg"}-result-${messages.length}`,
              type: "tool_result",
              role,
              content: txt,
              timestamp,
              model: currentModel || undefined,
            });
          }
        }
      }
    } catch {
      // skip malformed lines
    }
  }

  return messages;
}

async function getSessionMessages(sessionId: string, agentId?: string | null, key?: string | null): Promise<NextResponse> {
  if (!safeSessionId(sessionId)) {
    return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
  }

  const filePath = resolveSessionFilePath(sessionId, agentId || undefined, key || undefined);
  if (!filePath || !existsSync(filePath)) {
    return NextResponse.json({ error: "Session not found", messages: [] }, { status: 404 });
  }

  try {
    const messages = readSessionMessages(filePath);
    return NextResponse.json({
      sessionId,
      filePath,
      messages,
      total: messages.length,
    });
  } catch (error) {
    console.error("[sessions] Error reading session file:", error);
    return NextResponse.json({ error: "Failed to read session", messages: [] }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("id");
  const agentId = searchParams.get("agentId");
  const key = searchParams.get("key");

  if (sessionId) return getSessionMessages(sessionId, agentId, key);
  return listSessions();
}
