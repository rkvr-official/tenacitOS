import { NextResponse, NextRequest } from "next/server";
import { getDatabase, getCostSummary } from "@/lib/usage-queries";
import { getModelPricing, normalizeModelId } from "@/lib/pricing";
import { collectUsage } from "@/lib/usage-collector";
import path from "path";
import fs from "fs";
import os from "os";
import { execSync } from "child_process";

const DB_PATH = path.join(process.cwd(), "data", "usage-tracking.db");
const DEFAULT_BUDGET = 100.0;

type Deployment = "cloud" | "local" | "all";

let pptCache: { at: number; map: Map<string, any> } | null = null;

function fetchPricePerTokenMap(): Map<string, any> {
  const now = Date.now();
  if (pptCache && now - pptCache.at < 60 * 60 * 1000) return pptCache.map;

  const map = new Map<string, any>();
  try {
    const raw = execSync("curl -fsSL 'https://pricepertoken.com/_payload.json?75094636-d319-4399-af76-d29349705acb'", { encoding: "utf-8", timeout: 25000 });
    const arr = JSON.parse(raw);
    const refs: number[] = Array.isArray(arr?.[5]) ? arr[5] : [];

    const v = (x: any) => (typeof x === "number" && x >= 0 && x < arr.length ? arr[x] : x);
    for (const ref of refs) {
      const r = arr?.[ref];
      if (!r || typeof r !== "object") continue;
      const model = String(v(r.model) || "").toLowerCase();
      const slug = String(v(r.slug) || "").toLowerCase();
      const row = {
        model,
        slug,
        input: Number(v(r.input_price_per_1m_tokens) || 0),
        output: Number(v(r.output_price_per_1m_tokens) || 0),
        tps: Number(v(r.tokens_per_second) || 0),
        intel: v(r.benchmark_intelligence),
        coding: v(r.benchmark_coding),
        math: v(r.benchmark_math),
      };
      if (model) map.set(model, row);
      if (slug) map.set(slug, row);
    }
  } catch {}

  pptCache = { at: now, map };
  return map;
}

function estimateTps(model: string, local: boolean): number {
  const provider = model.split("/")[0] || "unknown";
  if (local) return 18;
  if (provider.includes("google")) return 95;
  if (provider.includes("openai")) return 75;
  if (provider.includes("anthropic")) return 60;
  return 50;
}

function providerFallbackPricing(model: string): { input: number; output: number } | null {
  const m = model.toLowerCase();
  if (m.startsWith("openai/") || m.startsWith("openai-codex/")) return { input: 3.0, output: 15.0 };
  if (m.startsWith("google/")) return { input: 0.35, output: 1.5 };
  if (m.startsWith("anthropic/")) return { input: 3.0, output: 15.0 };
  if (m.startsWith("openrouter/")) return { input: 0.5, output: 2.0 };
  return null;
}

function modelRankings(model: string, input: number | null, output: number | null, tpsCloud: number) {
  const cost = (input || 3) + (output || 15);
  const perfPrice = Number((1000 / Math.max(cost, 0.1)).toFixed(1));
  const m = model.toLowerCase();
  const complex = m.includes("pro") || m.includes("opus") || m.includes("o1") || m.includes("o3") || m.includes("o4") ? "high" : "medium";
  const research = m.includes("deep-research") || m.includes("pro") ? "high" : "medium";
  const thinking = m.includes("o1") || m.includes("o3") || m.includes("o4") || m.includes("codex") ? "high" : "medium";
  return { perfPrice, complex, research, thinking, speed: tpsCloud };
}

function getOpenclawModelsMap(): Map<string, { local: boolean; available: boolean; provider: string }> {
  const map = new Map<string, { local: boolean; available: boolean; provider: string }>();
  try {
    const raw = execSync("openclaw models list --json", { encoding: "utf-8", timeout: 12000 });
    const payload = JSON.parse(raw);
    for (const m of payload?.models || []) {
      const key = String(m.key);
      map.set(key, {
        local: !!m.local,
        available: !!m.available,
        provider: key.split("/")[0] || "unknown",
      });
    }
  } catch {}
  return map;
}

function getSelectedModels(db: any, deployment: Deployment) {
  const cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".openclaw", "openclaw.json"), "utf-8"));
  const models = new Set<string>();
  const defaults = cfg?.agents?.defaults?.model;
  if (defaults?.primary) models.add(defaults.primary);
  for (const m of defaults?.fallbacks || []) models.add(m);
  for (const m of Object.keys(cfg?.agents?.defaults?.models || {})) models.add(m);

  const modelMap = getOpenclawModelsMap();
  const ppt = fetchPricePerTokenMap();
  if (deployment === "local" || deployment === "all") {
    for (const [key, info] of modelMap.entries()) if (info.local) models.add(key);
  }

  const usageRows = db
    ? (db.prepare("SELECT model, SUM(cost) cost, SUM(total_tokens) tokens, GROUP_CONCAT(DISTINCT agent_id) agents FROM usage_snapshots GROUP BY model").all() as Array<any>)
    : [];
  const usageMap = new Map<string, any>();
  for (const r of usageRows) usageMap.set(normalizeModelId(r.model), r);

  let rows = Array.from(models).map((id) => {
    const p = getModelPricing(id);
    const fb = providerFallbackPricing(id);
    const inputPerM = p?.inputPricePerMillion ?? fb?.input ?? null;
    const outputPerM = p?.outputPricePerMillion ?? fb?.output ?? null;
    const info = modelMap.get(id) || modelMap.get(normalizeModelId(id)) || { local: false, available: true, provider: id.split("/")[0] || "unknown" };
    const tpsCloud = estimateTps(id, false);
    const tpsLocal = estimateTps(id, true);
    const localEstPerM = Number((((1_000_000 / Math.max(tpsLocal, 1)) / 3600) * 0.12).toFixed(2));
    const usage = usageMap.get(normalizeModelId(id)) || usageMap.get(id) || { cost: 0, tokens: 0, agents: "" };
    const agents = String(usage.agents || "").split(",").filter(Boolean);

    const short = String(id).split('/').slice(1).join('/').toLowerCase();
    const web = ppt.get(short) || ppt.get(String(id).toLowerCase()) || null;
    const webInput = web?.input != null ? Number(web.input) : null;
    const webOutput = web?.output != null ? Number(web.output) : null;
    const finalInput = webInput ?? inputPerM;
    const finalOutput = webOutput ?? outputPerM;

    return {
      model: id,
      inputPerM: finalInput,
      outputPerM: finalOutput,
      source: info.provider,
      pricingSource: web ? "pricepertoken" : (p ? "published/default" : fb ? "provider-default" : "missing"),
      local: info.local,
      available: info.available,
      tpsCloud: web?.tps ? Number(web.tps) : tpsCloud,
      tpsLocal,
      benchmarks: {
        intelligence: web?.intel ?? null,
        coding: web?.coding ?? null,
        math: web?.math ?? null,
      },
      ranking: modelRankings(id, finalInput, finalOutput, web?.tps ? Number(web.tps) : tpsCloud),
      usageCost: Number(usage.cost || 0),
      usageTokens: Number(usage.tokens || 0),
      agents,
      agentCount: agents.length,
    };
  });

  if (deployment === "cloud") rows = rows.filter((r) => !r.local);
  if (deployment === "local") rows = rows.filter((r) => r.local);

  rows.sort((a, b) => (b.usageCost - a.usageCost) || (b.agentCount - a.agentCount));
  return rows;
}

function getScopedData(db: any, days: number, allowedModels: string[] | null) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  if (!allowedModels || allowedModels.length === 0) {
    return { byAgent: [], byModel: [], daily: [], hourly: [] };
  }

  const qMarks = allowedModels.map(() => "?").join(",");

  const byModel = db.prepare(
    `SELECT model, SUM(cost) as cost, SUM(total_tokens) as tokens FROM usage_snapshots WHERE date >= ? AND model IN (${qMarks}) GROUP BY model ORDER BY cost DESC`
  ).all(cutoffStr, ...allowedModels);

  const byAgent = db.prepare(
    `SELECT agent_id as agent, SUM(cost) as cost, SUM(total_tokens) as tokens FROM usage_snapshots WHERE date >= ? AND model IN (${qMarks}) GROUP BY agent_id ORDER BY cost DESC`
  ).all(cutoffStr, ...allowedModels);

  const daily = db.prepare(
    `SELECT date, SUM(cost) as cost, SUM(input_tokens) as input, SUM(output_tokens) as output FROM usage_snapshots WHERE date >= ? AND model IN (${qMarks}) GROUP BY date ORDER BY date ASC`
  ).all(cutoffStr, ...allowedModels).map((r: any) => ({ ...r, date: String(r.date).slice(5) }));

  const hourly = db.prepare(
    `SELECT hour, SUM(cost) as cost FROM usage_snapshots WHERE model IN (${qMarks}) GROUP BY hour ORDER BY hour ASC`
  ).all(...allowedModels).map((r: any) => ({ hour: `${String(r.hour).padStart(2, "0")}:00`, cost: r.cost }));

  return { byAgent, byModel, daily, hourly };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const timeframe = searchParams.get("timeframe") || "30d";
  const deployment = (searchParams.get("deployment") || "cloud") as Deployment;
  const days = parseInt(timeframe.replace(/\D/g, ""), 10) || 30;

  try {
    const db = getDatabase(DB_PATH);
    const modelPricing = getSelectedModels(db, deployment);

    if (!db) {
      return NextResponse.json({
        today: 0, yesterday: 0, thisMonth: 0, lastMonth: 0, projected: 0, budget: DEFAULT_BUDGET,
        byAgent: [], byModel: [], daily: [], hourly: [], modelPricing,
        message: "No usage data collected yet. Run refresh.",
      });
    }

    const summary = getCostSummary(db);
    const allowedModels = modelPricing.map((m: any) => normalizeModelId(m.model));
    const scoped = getScopedData(db, days, allowedModels);

    db.close();

    return NextResponse.json({
      ...summary,
      budget: DEFAULT_BUDGET,
      byAgent: scoped.byAgent,
      byModel: scoped.byModel,
      daily: scoped.daily,
      hourly: scoped.hourly,
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
    if (body?.action === "refresh") {
      await collectUsage(DB_PATH);
      return NextResponse.json({ success: true, message: "Usage refreshed" });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
