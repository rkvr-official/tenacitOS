import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import {
  getDatabase,
  getCostSummary,
  getCostByAgent,
  getCostByModel,
  getDailyCost,
  getHourlyCost,
} from "@/lib/usage-queries";
import { getModelPricing } from "@/lib/pricing";
import path from "path";
import fs from "fs";
import os from "os";

const DB_PATH = path.join(process.cwd(), "data", "usage-tracking.db");
const DEFAULT_BUDGET = 100.0; // Default budget in USD

function getSelectedModelsWithPricing() {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".openclaw", "openclaw.json"), "utf-8"));
    const models = new Set<string>();

    const defaults = cfg?.agents?.defaults?.model;
    if (defaults?.primary) models.add(defaults.primary);
    for (const m of defaults?.fallbacks || []) models.add(m);
    for (const m of Object.keys(cfg?.agents?.defaults?.models || {})) models.add(m);

    return Array.from(models).map((id) => {
      const p = getModelPricing(id);
      return {
        model: id,
        inputPerM: p?.inputPricePerMillion ?? null,
        outputPerM: p?.outputPricePerMillion ?? null,
        source: p ? "published/default" : "missing",
      };
    });
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const timeframe = searchParams.get("timeframe") || "30d";

  // Parse timeframe to days
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
        modelPricing: getSelectedModelsWithPricing(),
        message: "No usage data collected yet. Run collect-usage script first.",
      });
    }

    // Get all the data
    const summary = getCostSummary(db);
    const byAgent = getCostByAgent(db, days);
    const byModel = getCostByModel(db, days);
    const daily = getDailyCost(db, days);
    const hourly = getHourlyCost(db);

    db.close();

    return NextResponse.json({
      ...summary,
      budget: DEFAULT_BUDGET,
      byAgent,
      byModel,
      daily,
      hourly,
      modelPricing: getSelectedModelsWithPricing(),
    });
  } catch (error) {
    console.error("Error fetching cost data:", error);
    return NextResponse.json(
      { error: "Failed to fetch cost data" },
      { status: 500 }
    );
  }
}

// POST endpoint to update budget
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { budget, alerts } = body;

    // In production, save to database
    // For now, just return success
    
    return NextResponse.json({
      success: true,
      budget,
      alerts,
    });
  } catch (error) {
    console.error("Error updating budget:", error);
    return NextResponse.json(
      { error: "Failed to update budget" },
      { status: 500 }
    );
  }
}
