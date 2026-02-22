/**
 * Usage Collector - Reads OpenClaw session data and calculates costs
 */

import { exec } from "child_process";
import { promisify } from "util";
import { calculateCost, normalizeModelId } from "./pricing";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const execAsync = promisify(exec);

export interface SessionData {
  agentId: string;
  sessionKey: string;
  sessionId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  updatedAt: number;
  percentUsed: number;
}

function agentIdFromKey(key: string): string {
  const parts = String(key || "").split(":");
  if (parts[0] === "agent" && parts[1]) return parts[1];
  return "unknown";
}

export interface UsageSnapshot {
  timestamp: number;
  date: string; // YYYY-MM-DD
  hour: number; // 0-23
  agentId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
}

/**
 * Get all OpenClaw sessions with historical data
 */
export async function getOpenClawSessions(): Promise<SessionData[]> {
  try {
    const openclawDir = process.env.OPENCLAW_DIR || "/root/.openclaw";
    const agentsDir = path.join(openclawDir, "agents");
    const paths: string[] = [];

    if (fs.existsSync(agentsDir)) {
      for (const a of fs.readdirSync(agentsDir)) {
        const p = path.join(agentsDir, a, "sessions", "sessions.json");
        if (fs.existsSync(p)) paths.push(p);
      }
    }

    const sessions: SessionData[] = [];

    for (const pth of paths) {
      const obj = JSON.parse(fs.readFileSync(pth, "utf-8"));
      for (const [key, meta] of Object.entries<any>(obj || {})) {
        const agentId = agentIdFromKey(key);
        const sessionId = meta?.sessionId || "";
        let model = normalizeModelId(meta?.model || "unknown");

        if ((model === "unknown" || !model) && sessionId) {
          try {
            const sessionFile = path.join(path.dirname(pth), `${sessionId}.jsonl`);
            if (fs.existsSync(sessionFile)) {
              const lines = fs.readFileSync(sessionFile, 'utf-8').split("\n");
              for (const ln of lines) {
                if (!ln.trim()) continue;
                const row = JSON.parse(ln);
                if (row?.type === 'model_change' && row?.modelId) { model = normalizeModelId(row.modelId); break; }
              }
            }
          } catch {}
        }

        sessions.push({
          agentId,
          sessionKey: key,
          sessionId,
          model,
          inputTokens: meta?.inputTokens || 0,
          outputTokens: meta?.outputTokens || 0,
          totalTokens: meta?.totalTokens || 0,
          updatedAt: meta?.updatedAt || Date.now(),
          percentUsed: meta?.percentUsed || 0,
        });
      }
    }

    return sessions;
  } catch (error) {
    console.error("Error getting OpenClaw sessions:", error);
    throw error;
  }
}

/**
 * Calculate snapshots from session totals (one row per session)
 */
export function calculateSnapshot(
  sessions: SessionData[],
  timestamp: number
): UsageSnapshot[] {
  return sessions.map((s) => {
    const ts = s.updatedAt || timestamp;
    const d = new Date(ts);
    return {
      timestamp: ts,
      date: d.toISOString().split("T")[0],
      hour: d.getUTCHours(),
      agentId: s.agentId,
      model: s.model,
      inputTokens: s.inputTokens,
      outputTokens: s.outputTokens,
      totalTokens: s.totalTokens,
      cost: calculateCost(s.model, s.inputTokens, s.outputTokens),
    };
  });
}

/**
 * Initialize SQLite database for usage tracking
 */
export function initDatabase(dbPath: string): Database.Database {
  // Ensure directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);

  // Create table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS usage_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      date TEXT NOT NULL,
      hour INTEGER NOT NULL,
      agent_id TEXT NOT NULL,
      model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      total_tokens INTEGER NOT NULL,
      cost REAL NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_date ON usage_snapshots(date);
    CREATE INDEX IF NOT EXISTS idx_agent ON usage_snapshots(agent_id);
    CREATE INDEX IF NOT EXISTS idx_model ON usage_snapshots(model);
    CREATE INDEX IF NOT EXISTS idx_timestamp ON usage_snapshots(timestamp);
  `);

  return db;
}

/**
 * Save snapshot to database
 */
export function saveSnapshot(
  db: Database.Database,
  snapshot: UsageSnapshot
): void {
  const stmt = db.prepare(`
    INSERT INTO usage_snapshots 
      (timestamp, date, hour, agent_id, model, input_tokens, output_tokens, total_tokens, cost)
    VALUES 
      (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    snapshot.timestamp,
    snapshot.date,
    snapshot.hour,
    snapshot.agentId,
    snapshot.model,
    snapshot.inputTokens,
    snapshot.outputTokens,
    snapshot.totalTokens,
    snapshot.cost
  );
}

/**
 * Collect and save current usage data
 * This captures a point-in-time snapshot of current session totals
 */
export async function collectUsage(dbPath: string): Promise<void> {
  const db = initDatabase(dbPath);

  try {
    // Get all historical sessions
    const sessions = await getOpenClawSessions();
    const timestamp = Date.now();
    const snapshots = calculateSnapshot(sessions, timestamp);

    // Full rebuild to avoid drift/duplicates and include all past sessions
    db.prepare(`DELETE FROM usage_snapshots`).run();

    for (const snapshot of snapshots) {
      saveSnapshot(db, snapshot);
    }

    console.log(`Rebuilt ${snapshots.length} usage snapshots from all sessions`);
  } finally {
    db.close();
  }
}
