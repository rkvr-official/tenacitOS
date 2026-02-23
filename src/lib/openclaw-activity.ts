import { execSync } from "child_process";

export interface DerivedActivity {
  id: string;
  timestamp: string;
  type: string;
  description: string;
  status: string;
  duration_ms: number | null;
  tokens_used: number | null;
  agent: string | null;
  metadata: Record<string, unknown> | null;
}

function runJson(command: string): any {
  const output = execSync(command, {
    timeout: 15000,
    encoding: "utf-8",
    maxBuffer: 8 * 1024 * 1024,
  });
  const idx = output.indexOf("{");
  const safe = idx >= 0 ? output.slice(idx) : output;
  return JSON.parse(safe);
}

function typeFromSessionKey(key: string): string {
  if (key.includes(":cron:")) return "cron";
  if (key.includes(":slack:") || key.includes(":telegram:") || key.includes(":discord:")) return "message";
  if (key.includes(":subagent:")) return "task";
  if (key.includes(":run:")) return "task";
  return "agent_action";
}

function normalizeStatus(raw: any, ageMs: number): "success" | "error" | "pending" | "running" {
  if (raw === true || raw === "error") return "error";
  if (ageMs < 2 * 60 * 1000) return "running";
  return "success";
}

function summarizeKey(key: string): string {
  const parts = key.split(":");
  const agent = parts[1] || "agent";
  if (key.includes(":cron:")) {
    const idx = parts.indexOf("cron");
    const job = idx >= 0 ? parts[idx + 1] : "cron-job";
    return `${agent} ran cron job ${job}`;
  }
  if (key.includes(":slack:") || key.includes(":telegram:") || key.includes(":discord:")) {
    return `${agent} handled a chat session`;
  }
  if (key.includes(":subagent:")) {
    return `${agent} delegated to subagent`;
  }
  return `${agent} updated session`;
}

function safeNum(v: any): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export function getOpenclawDerivedActivities(): DerivedActivity[] {
  const out: DerivedActivity[] = [];

  // Sessions
  try {
    const payload = runJson("openclaw sessions list --json");
    const sessions = Array.isArray(payload?.sessions) ? payload.sessions : [];
    for (const s of sessions) {
      const key = String(s?.key || "");
      if (!key.startsWith("agent:")) continue;
      const updatedAt = safeNum(s?.updatedAt);
      const timestamp = updatedAt > 0 ? new Date(updatedAt).toISOString() : new Date().toISOString();
      const ageMs = safeNum(s?.ageMs);
      const parts = key.split(":");
      const agent = parts[1] || null;

      out.push({
        id: `oc-session-${key}`,
        timestamp,
        type: typeFromSessionKey(key),
        description: summarizeKey(key),
        status: normalizeStatus(s?.abortedLastRun, ageMs),
        duration_ms: null,
        tokens_used: safeNum(s?.totalTokens) || null,
        agent,
        metadata: {
          key,
          model: s?.model || null,
          provider: s?.modelProvider || null,
          inputTokens: safeNum(s?.inputTokens),
          outputTokens: safeNum(s?.outputTokens),
          contextTokens: safeNum(s?.contextTokens),
        },
      });
    }
  } catch {
    // best effort
  }

  // Cron jobs + latest runs
  try {
    const jobsPayload = runJson("openclaw cron list --json --all");
    const jobs = Array.isArray(jobsPayload?.jobs) ? jobsPayload.jobs : [];

    for (const j of jobs) {
      const id = String(j?.id || "");
      if (!id) continue;

      if (j?.lastRunAtMs) {
        out.push({
          id: `oc-cron-last-${id}-${j.lastRunAtMs}`,
          timestamp: new Date(Number(j.lastRunAtMs)).toISOString(),
          type: "cron",
          description: `cron ${j.name || id} last run`,
          status: j?.enabled === false ? "pending" : "success",
          duration_ms: null,
          tokens_used: null,
          agent: String(j?.agentId || "") || null,
          metadata: {
            cronId: id,
            name: j?.name || null,
            enabled: !!j?.enabled,
            schedule: j?.scheduleDisplay || null,
          },
        });
      }

      try {
        const runsPayload = runJson(`openclaw cron runs --id ${id} --limit 2 --timeout 30000`);
        const runs = Array.isArray(runsPayload?.entries)
          ? runsPayload.entries
          : Array.isArray(runsPayload?.runs)
          ? runsPayload.runs
          : [];

        for (const r of runs) {
          const runAtMs = safeNum(r?.runAtMs || r?.ts);
          if (!runAtMs) continue;
          out.push({
            id: `oc-cron-run-${id}-${runAtMs}`,
            timestamp: new Date(runAtMs).toISOString(),
            type: "cron_run",
            description: `cron ${id}: ${String(r?.summary || r?.status || "finished").slice(0, 140)}`,
            status: r?.status === "ok" ? "success" : "error",
            duration_ms: typeof r?.durationMs === "number" ? r.durationMs : null,
            tokens_used: typeof r?.usage?.total_tokens === "number" ? r.usage.total_tokens : null,
            agent: null,
            metadata: {
              cronId: id,
              model: r?.model || null,
              provider: r?.provider || null,
              summary: r?.summary || null,
              sessionId: r?.sessionId || null,
            },
          });
        }
      } catch {
        // per-cron run fetch may fail; ignore
      }
    }
  } catch {
    // best effort
  }

  return out;
}
