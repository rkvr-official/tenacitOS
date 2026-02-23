import { NextResponse } from "next/server";
import os from "os";
import path from "path";
import { existsSync, statSync } from "fs";
import { getAgents, getSessions } from "@/lib/openclaw";

export const dynamic = "force-dynamic";

type OfficeStatus = "working" | "thinking" | "idle" | "error" | "sleeping";

function statusFromSession(s: any): OfficeStatus {
  const ageMs = typeof s?.ageMs === "number" ? s.ageMs : Number.MAX_SAFE_INTEGER;
  if (s?.abortedLastRun || s?.aborted) return "error";
  if (ageMs < 2 * 60 * 1000 && (s?.outputTokens || 0) < 200) return "thinking";
  if (ageMs < 10 * 60 * 1000) return "working";
  if (ageMs < 60 * 60 * 1000) return "idle";
  return "sleeping";
}

function taskFromSession(s: any): string {
  const key = String(s?.key || "");
  if (key.includes(":cron:")) {
    const parts = key.split(":");
    const idx = parts.indexOf("cron");
    const jobId = idx >= 0 ? parts[idx + 1] : "cron";
    return `Cron: ${jobId}`;
  }
  if (key.includes(":slack:")) return "Handling Slack conversation";
  if (key.includes(":telegram:")) return "Handling Telegram conversation";
  if (key.includes(":discord:")) return "Handling Discord conversation";
  if (key.includes(":subagent:")) return "Delegating subagent workflow";
  return "Working on session";
}

function activityTextFromSession(s: any): string {
  const key = String(s?.key || "");
  if (key.includes(":cron:")) {
    const parts = key.split(":");
    const idx = parts.indexOf("cron");
    const jobId = idx >= 0 ? parts[idx + 1] : "cron";
    return `Executed cron ${jobId}`;
  }
  if (key.includes(":slack:")) return "Processed Slack message";
  if (key.includes(":telegram:")) return "Processed Telegram message";
  if (key.includes(":discord:")) return "Processed Discord message";
  if (key.includes(":subagent:")) return "Delegated subagent task";
  return "Session updated";
}

function fallbackLastSeenFromStore(agentId: string): number {
  const openclawDir = process.env.OPENCLAW_DIR || "/root/.openclaw";
  const store = path.join(openclawDir, "agents", agentId, "sessions", "sessions.json");
  if (!existsSync(store)) return 0;
  try {
    return statSync(store).mtimeMs;
  } catch {
    return 0;
  }
}

export async function GET() {
  try {
    const agents = getAgents();

    const hostUptimeDays = Math.floor(os.uptime() / 86400);
    const now = Date.now();

    const result = agents.map((a) => {
      const agentSessions = getSessions(a.id) || [];
      const latest = agentSessions[0];

      const status: OfficeStatus = latest
        ? statusFromSession(latest)
        : a.currentState === "SLEEPING"
        ? "sleeping"
        : a.currentState === "ACTIVE"
        ? "working"
        : "idle";

      const currentTask = latest
        ? taskFromSession(latest)
        : a.currentState === "SLEEPING"
        ? "SLEEPING: zzZ..."
        : a.currentState === "ACTIVE"
        ? "WORKING"
        : "IDLE";

      const lastSeen =
        latest?.updatedAt ||
        (a.lastActivity ? new Date(a.lastActivity).getTime() : 0) ||
        fallbackLastSeenFromStore(a.id);

      const oneHourAgo = now - 60 * 60 * 1000;
      const recentHour = agentSessions.filter((s) => (s?.updatedAt || 0) >= oneHourAgo);
      const tokensPerHour = recentHour.reduce((sum, s) => sum + (Number(s?.totalTokens || 0) || 0), 0);

      const tasksInQueue = agentSessions.filter((s) => (s?.ageMs || Number.MAX_SAFE_INTEGER) < 2 * 60 * 1000).length;

      const recentActivity = agentSessions.slice(0, 4).map((s) => ({
        at: Number(s?.updatedAt || 0),
        text: activityTextFromSession(s),
      }));
      if (recentActivity.length === 0 && lastSeen > 0) {
        recentActivity.push({
          at: lastSeen,
          text: currentTask === "SLEEPING: zzZ..." ? "No recent execution" : `State: ${currentTask}`,
        });
      }

      return {
        id: a.id,
        name: a.name,
        emoji: a.emoji,
        color: a.color,
        role: a.isOrchestrator ? "Orchestrator" : "Specialist",
        currentTask,
        status,
        lastSeen,
        model: a.model,
        tokensPerHour,
        tasksInQueue,
        activeSessions: a.activeSessions,
        uptime: hostUptimeDays,
        recentActivity,
      };
    });

    return NextResponse.json({ agents: result });
  } catch (error) {
    console.error("Error getting office data:", error);
    return NextResponse.json({ error: "Failed to load office data" }, { status: 500 });
  }
}
