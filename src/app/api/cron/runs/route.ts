import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";

export const dynamic = "force-dynamic";

interface CronRunEntry {
  id: string;
  jobId: string;
  startedAt: string | null;
  completedAt: string | null;
  status: string;
  durationMs: number | null;
  error: string | null;
  summary: string | null;
  runAtMs: number | null;
  nextRunAtMs: number | null;
  model?: string;
  provider?: string;
  sessionId?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  } | null;
}

function parseJsonLoose(raw: string): any {
  const start = raw.indexOf("{");
  if (start >= 0) {
    return JSON.parse(raw.slice(start));
  }
  return JSON.parse(raw);
}

function mapRun(r: any, fallbackJobId: string): CronRunEntry {
  const runAtMs = Number(r?.runAtMs || r?.ts || 0) || null;
  const startedAt = runAtMs ? new Date(runAtMs).toISOString() : (r?.startedAt || r?.createdAt || null);
  const completedAt = runAtMs && r?.durationMs ? new Date(runAtMs + Number(r.durationMs)).toISOString() : (r?.completedAt || r?.finishedAt || null);

  return {
    id: String(r?.id || `${fallbackJobId}-${runAtMs || Date.now()}`),
    jobId: String(r?.jobId || fallbackJobId),
    startedAt,
    completedAt,
    status: String(r?.status || r?.action || "unknown"),
    durationMs: typeof r?.durationMs === "number" ? r.durationMs : null,
    error: r?.error ? String(r.error) : null,
    summary: r?.summary ? String(r.summary) : null,
    runAtMs,
    nextRunAtMs: typeof r?.nextRunAtMs === "number" ? r.nextRunAtMs : null,
    model: r?.model ? String(r.model) : undefined,
    provider: r?.provider ? String(r.provider) : undefined,
    sessionId: r?.sessionId ? String(r.sessionId) : undefined,
    usage: r?.usage || null,
  };
}

function getRunsForJob(jobId: string, limit: number): CronRunEntry[] {
  try {
    const output = execSync(`openclaw cron runs --id ${jobId} --limit ${Math.max(1, limit)} --timeout 30000`, {
      timeout: 40000,
      encoding: "utf-8",
      maxBuffer: 8 * 1024 * 1024,
    });

    const parsed = parseJsonLoose(output);
    const rows = Array.isArray(parsed?.entries)
      ? parsed.entries
      : Array.isArray(parsed?.runs)
      ? parsed.runs
      : Array.isArray(parsed)
      ? parsed
      : [];

    return rows.map((r: any) => mapRun(r, jobId));
  } catch {
    return [];
  }
}

function getAllJobs(): string[] {
  try {
    const output = execSync("openclaw cron list --json --all 2>/dev/null", {
      timeout: 15000,
      encoding: "utf-8",
    });
    const parsed = JSON.parse(output);
    const jobs = Array.isArray(parsed?.jobs) ? parsed.jobs : [];
    return jobs.map((j: any) => String(j.id)).filter(Boolean);
  } catch {
    return [];
  }
}

// GET:
// - /api/cron/runs?id=<jobId>[&limit=10]
// - /api/cron/runs?all=1[&limit=3]
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const all = searchParams.get("all") === "1";
    const limit = Number(searchParams.get("limit") || 10);

    if (!id && !all) {
      return NextResponse.json({ error: "Job ID required (or all=1)" }, { status: 400 });
    }

    if (id && !/^[a-zA-Z0-9_-]+$/.test(id)) {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
    }

    if (all) {
      const jobs = getAllJobs();
      const merged: CronRunEntry[] = [];
      for (const jobId of jobs) {
        merged.push(...getRunsForJob(jobId, limit));
      }
      merged.sort((a, b) => (b.runAtMs || 0) - (a.runAtMs || 0));
      return NextResponse.json({ runs: merged, total: merged.length, jobs: jobs.length });
    }

    const runs = getRunsForJob(id!, limit);
    return NextResponse.json({ runs, total: runs.length });
  } catch (error) {
    console.error("Error fetching run history:", error);
    return NextResponse.json({ error: "Failed to fetch run history" }, { status: 500 });
  }
}
