import { NextResponse, NextRequest } from "next/server";
import {
  getDatabase,
  getCostSummary,
  getCostByAgent,
  getCostByModel,
  getDailyCost,
  getHourlyCost,
} from "@/lib/usage-queries";
import { getModelPricing, normalizeModelId } from "@/lib/pricing";
import { collectUsage } from "@/lib/usage-collector";
import path from "path";
import fs from "fs";
import os from "os";
import { execSync } from "child_process";

const DB_PATH = path.join(process.cwd(), "data", "usage-tracking.db");
const DEFAULT_BUDGET = 100.0;

function estimateTps(model: string, local: boolean): number {
  const provider = model.split("/")[0] || "unknown";
  if (local) return 18;
  if (provider.includes("google")) return 95;
  if (provider.includes("openai")) return 75;
  if (provider.includes("anthropic")) return 60;
  if (provider.includes("openrouter")) return 45;
  return 50;
}


function providerFallbackPricing(model: string): { input: number; output: number } | null {
  const m = model.toLowerCase();
  if (m.startsWith('openai/')) return { input: 3.0, output: 15.0 };
  if (m.startsWith('openai-codex/')) return { input: 3.0, output: 15.0 };
  if (m.startsWith('google/')) return { input: 0.35, output: 1.5 };
  if (m.startsWith('anthropic/')) return { input: 3.0, output: 15.0 };
  if (m.startsWith('openrouter/')) return { input: 0.5, output: 2.0 };
  return null;
}

function getOpenclawModelsMap(): Map<string, { local: boolean; available: boolean }> {
  const map = new Map<string, { local: boolean; available: boolean }>();
  try {
    const raw = execSync("openclaw models list --json", { encoding: "utf-8", timeout: 12000 });
    const payload = JSON.parse(raw);
    for (const m of payload?.models || []) {
      map.set(String(m.key), { local: !!m.local, available: !!m.available });
    }
  } catch {}
  return map;
}

function getSelectedModelsWithPricing(db: ReturnType<typeof getDatabase>, deployment: "cloud" | "local" | "all") {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".openclaw", "openclaw.json"), "utf-8"));
    const models = new Set<string>();

    const defaults = cfg?.agents?.defaults?.model;
    if (defaults?.primary) models.add(defaults.primary);
    for (const m of defaults?.fallbacks || []) models.add(m);
    for (const m of Object.keys(cfg?.agents?.defaults?.models || {})) models.add(m);

    const modelMap = getOpenclawModelsMap();

    const byModelAgents = new Map<string, string[]>();
    if (db) {
      const rows = db
        .prepare("SELECT model, GROUP_CONCAT(DISTINCT agent_id) as agents FROM usage_snapshots GROUP BY model")
        .all() as Array<{ model: string; agents: string }>;
      for (const r of rows) {
        byModelAgents.set(normalizeModelId(r.model), String(r.agents || "").split(",").filter(Boolean));
      }
    }

    const rows = Array.from(models).map((id) => {
      const p = getModelPricing(id);
      const normalized = normalizeModelId(id);
      const info = modelMap.get(id) || modelMap.get(normalized) || { local: false, available: true };
      const tpsCloud = estimateTps(id, false);
      const tpsLocal = estimateTps(id, true);
      const vpsHourly = 0.12;
      const localEstPerM = Number((((1_000_000 / Math.max(tpsLocal, 1)) / 3600) * vpsHourly).toFixed(2));

      const fb = providerFallbackPricing(id);
      const inputPerM = p?.inputPricePerMillion ?? fb?.input ?? null;
      const outputPerM = p?.outputPricePerMillion ?? fb?.output ?? null;

      return {
        model: id,
        inputPerM,
        outputPerM,
        localEstPerM,
        source: p ? "published/default" : (fb ? "provider-default" : "missing"),
        local: info.local,
        available: info.available,
        tpsCloud,
        tpsLocal,
        agents: byModelAgents.get(normalized) || byModelAgents.get(id) || [],
      };
    });

    if (deployment === "cloud") return rows.filter((r) => !r.local);
    if (deployment === "local") return rows.filter((r) => r.local);
    return rows;
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const timeframe = searchParams.get("timeframe") || "30d";
  const deployment = (searchParams.get("deployment") || "cloud") as "cloud" | "local" | "all";
  const days = parseInt(timeframe.replace(/\D/g, ""), 10) || 30;

  try {
    const db = getDatabase(DB_PATH);

    if (!db) {
      return NextResponse.json({
        today: 0,
        yesterday: 0,
        thisMonth: 0,
        lastMonth: 0,
        projected: 0,
        budget: DEFAULT_BUDGET,
        byAgent: [],
        byModel: [],
        daily: [],
        hourly: [],
        modelPricing: getSelectedModelsWithPricing(null, deployment),
        message: "No usage data collected yet. Run collect-usage script first.",
      });
    }

    const summary = getCostSummary(db);
    const byAgent = getCostByAgent(db, days);
    const byModel = getCostByModel(db, days);
    const daily = getDailyCost(db, days);
    const hourly = getHourlyCost(db);
    const modelPricing = getSelectedModelsWithPricing(db, deployment);

    db.close();

    return NextResponse.json({
      ...summary,
      budget: DEFAULT_BUDGET,
      byAgent,
      byModel,
      daily,
      hourly,
      modelPricing,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching cost data:", error);
    return NextResponse.json({ error: "Failed to fetch cost data" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body?.action;

    if (action === "refresh") {
      await collectUsage(DB_PATH);
      return NextResponse.json({ success: true, message: "Usage refreshed from OpenClaw session stores" });
    }

    const { budget, alerts } = body;
    return NextResponse.json({ success: true, budget, alerts });
  } catch (error) {
    console.error("Error updating budget:", error);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
