import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { readFileSync, statSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

const AGENT_CONFIG = {
  main: { emoji: "🦞", color: "#ff6b35", name: "Tenacitas", role: "Boss" },
  academic: {
    emoji: "🎓",
    color: "#4ade80",
    name: "Profe",
    role: "Teacher",
  },
  infra: {
    emoji: "🔧",
    color: "#f97316",
    name: "Infra",
    role: "DevOps",
  },
  studio: {
    emoji: "🎬",
    color: "#a855f7",
    name: "Studio",
    role: "Video Editor",
  },
  social: {
    emoji: "📱",
    color: "#ec4899",
    name: "Social",
    role: "Social Media",
  },
  linkedin: {
    emoji: "💼",
    color: "#0077b5",
    name: "LinkedIn Pro",
    role: "Professional",
  },
  devclaw: {
    emoji: "👨‍💻",
    color: "#8b5cf6",
    name: "DevClaw",
    role: "Developer",
  },
  freelance: {
    emoji: "👨‍💻",
    color: "#8b5cf6",
    name: "DevClaw",
    role: "Developer",
  },
};

type AgentOfficeStatus = {
  status: "working" | "thinking" | "idle" | "error" | "sleeping";
  currentTask: string;
  lastSeen: number;
};

function computeStatusFromSessions(sessions: Array<any>): Record<string, AgentOfficeStatus> {
  const byAgent: Record<string, any> = {};

  for (const s of sessions) {
    const agentId = s.agentId;
    if (!agentId) continue;

    // Keep most recently updated session per agent
    if (!byAgent[agentId] || (s.updatedAt ?? 0) > (byAgent[agentId].updatedAt ?? 0)) {
      byAgent[agentId] = s;
    }
  }

  const now = Date.now();
  const out: Record<string, AgentOfficeStatus> = {};

  for (const [agentId, s] of Object.entries(byAgent)) {
    const updatedAt = typeof s.updatedAt === "number" ? s.updatedAt : 0;
    const ageMs = now - updatedAt;

    // ERROR: last run aborted
    if (s.abortedLastRun) {
      out[agentId] = {
        status: "error",
        currentTask: "ERROR: last run aborted",
        lastSeen: updatedAt,
      };
      continue;
    }

    // THINKING: task just arrived / planning phase
    // Heuristic: very recent update + very low output tokens.
    const outputTokens = typeof s.outputTokens === "number" ? s.outputTokens : 0;
    if (ageMs < 2 * 60 * 1000 && outputTokens < 200) {
      out[agentId] = {
        status: "thinking",
        currentTask: "THINKING: planning",
        lastSeen: updatedAt,
      };
      continue;
    }

    // WORKING: recently active
    if (ageMs < 10 * 60 * 1000) {
      out[agentId] = {
        status: "working",
        currentTask: "WORKING",
        lastSeen: updatedAt,
      };
      continue;
    }

    // IDLE: somewhat recent
    if (ageMs < 60 * 60 * 1000) {
      out[agentId] = {
        status: "idle",
        currentTask: "IDLE",
        lastSeen: updatedAt,
      };
      continue;
    }

    out[agentId] = {
      status: "sleeping",
      currentTask: "SLEEPING: zzZ...",
      lastSeen: updatedAt,
    };
  }

  return out;
}

function resolveWorkspace(config: any, agentId: string, agentConfig: any): string {
  if (typeof agentConfig?.workspace === "string" && agentConfig.workspace.length) return agentConfig.workspace;
  const openclawDir = process.env.OPENCLAW_DIR || "/root/.openclaw";
  const baseWorkspace = config?.agents?.defaults?.workspace || join(openclawDir, "workspace");
  const defaultAgentId = config?.heartbeat?.defaultAgentId || config?.agents?.list?.[0]?.id;
  if (agentId && agentId === defaultAgentId) return baseWorkspace;
  return `${baseWorkspace}-${agentId}`;
}

function getAgentStatusFromFiles(
  workspace: string
): { isActive: boolean; currentTask: string; lastSeen: number } {
  try {
    const today = new Date().toISOString().split("T")[0];
    const memoryFile = join(workspace, "memory", `${today}.md`);

    // Check if file exists
    const stat = statSync(memoryFile);
    const lastSeen = stat.mtime.getTime();
    const minutesSinceUpdate = (Date.now() - lastSeen) / 1000 / 60;

    const content = readFileSync(memoryFile, "utf-8");
    const lines = content.trim().split("\n").filter((l) => l.trim());

    let currentTask = "Idle...";
    if (lines.length > 0) {
      // Get last meaningful line (skip timestamps)
      const lastLine = lines
        .slice(-10)
        .reverse()
        .find((l) => l.length > 20 && !l.match(/^#+\s/));

      if (lastLine) {
        currentTask = lastLine.replace(/^[-*]\s*/, "").slice(0, 100);
        if (lastLine.length > 100) currentTask += "...";
      }
    }

    // Determine status based on file modification time
    if (minutesSinceUpdate < 5) {
      return { isActive: true, currentTask: `ACTIVE: ${currentTask}`, lastSeen };
    } else if (minutesSinceUpdate < 30) {
      return { isActive: false, currentTask: `IDLE: ${currentTask}`, lastSeen };
    } else {
      return { isActive: false, currentTask: "SLEEPING: zzZ...", lastSeen };
    }
  } catch (error) {
    // No memory file or error reading
    return { isActive: false, currentTask: "SLEEPING: zzZ...", lastSeen: 0 };
  }
}

export async function GET() {
  try {
    const configPath = (process.env.OPENCLAW_DIR || "/root/.openclaw") + "/openclaw.json";
    const config = JSON.parse(readFileSync(configPath, "utf-8"));

    // Sessions signal (best-effort): uses OpenClaw's session index.
    // Falls back to memory file timestamps when session info is missing.
    let sessionStatus: Record<string, AgentOfficeStatus> = {};
    try {
      const raw = execSync("openclaw sessions list --json", {
        encoding: "utf8",
        timeout: 4000,
        env: process.env,
      });
      const parsed = JSON.parse(raw);
      const recent = (parsed?.recent ?? parsed?.sessions?.recent ?? parsed) as Array<any>;
      if (Array.isArray(recent)) sessionStatus = computeStatusFromSessions(recent);
    } catch {
      // ignore
    }

    const agents = config.agents.list.map((agent: any) => {
      const agentInfo = AGENT_CONFIG[agent.id as keyof typeof AGENT_CONFIG] || {
        emoji: "🤖",
        color: "#666",
        name: agent.name || agent.id,
        role: "Agent",
      };

      // Get status from sessions, or fallback to files
      let status = sessionStatus[agent.id];
      if (!status) {
        const workspace = resolveWorkspace(config, agent.id, agent);
        const fileStatus = getAgentStatusFromFiles(workspace);
        status = {
          status: fileStatus.isActive ? "working" : "sleeping",
          currentTask: fileStatus.currentTask,
          lastSeen: fileStatus.lastSeen,
        };
      }

      // Map freelance -> devclaw for canvas compatibility
      const canvasId = agent.id === "freelance" ? "devclaw" : agent.id;

      return {
        id: canvasId,
        name: agentInfo.name,
        emoji: agentInfo.emoji,
        color: agentInfo.color,
        role: agentInfo.role,
        currentTask: status.currentTask,
        status: status.status,
        lastSeen: status.lastSeen,
      };
    });

    return NextResponse.json({ agents });
  } catch (error) {
    console.error("Error getting office data:", error);
    return NextResponse.json(
      { error: "Failed to load office data" },
      { status: 500 }
    );
  }
}
