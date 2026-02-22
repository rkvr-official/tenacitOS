import fs from 'fs/promises';
import path from 'path';
import { fetchOpenRouterPricingMap, normalizeModelId, type OpenRouterModelPricing } from './openrouter';

export type SessionUsage = {
  agentId: string;
  sessionKey: string;
  updatedAt: number;
  modelId: string; // canonical-ish (provider/model)
  inputTokens: number;
  outputTokens: number;
};

export type CostRow = {
  cost: number;
  tokens: number;
  input: number;
  output: number;
};

function startOfDayUTC(ts: number) {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function ymUTC(ts: number) {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function formatDayUTC(ts: number) {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function hourUTC(ts: number) {
  const d = new Date(ts);
  return String(d.getUTCHours()).padStart(2, '0');
}

function toModelId(rec: any): string {
  // Prefer explicit provider/model when available.
  const provider = rec?.modelProvider;
  const model = rec?.model;
  if (typeof model === 'string' && model.includes('/')) return model;
  if (typeof provider === 'string' && typeof model === 'string') return `${provider}/${model}`;

  // systemPromptReport often has provider/model
  const spr = rec?.systemPromptReport;
  if (spr?.provider && spr?.model) return `${spr.provider}/${spr.model}`;

  // Fallback
  return String(model ?? provider ?? 'unknown');
}

export async function readAllSessionUsages(openclawDir = '/root/.openclaw'): Promise<SessionUsage[]> {
  const agentsDir = path.join(openclawDir, 'agents');
  let agentIds: string[] = [];
  try {
    agentIds = (await fs.readdir(agentsDir, { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }

  const usages: SessionUsage[] = [];

  for (const agentId of agentIds) {
    const sessionsIndex = path.join(agentsDir, agentId, 'sessions', 'sessions.json');
    let raw: string;
    try {
      raw = await fs.readFile(sessionsIndex, 'utf8');
    } catch {
      continue;
    }

    let json: any;
    try {
      json = JSON.parse(raw);
    } catch {
      continue;
    }

    for (const [sessionKey, rec] of Object.entries<any>(json ?? {})) {
      const updatedAt = Number(rec?.updatedAt);
      if (!Number.isFinite(updatedAt)) continue;

      const inputTokens = Number(rec?.inputTokens ?? 0);
      const outputTokens = Number(rec?.outputTokens ?? 0);
      if (!Number.isFinite(inputTokens) || !Number.isFinite(outputTokens)) continue;

      usages.push({
        agentId,
        sessionKey,
        updatedAt,
        modelId: toModelId(rec),
        inputTokens,
        outputTokens,
      });
    }
  }

  return usages;
}

function computeCostFor(
  usage: SessionUsage,
  pricingMap: Map<string, OpenRouterModelPricing>
): number | null {
  const id = normalizeModelId(usage.modelId);
  const p = pricingMap.get(id);
  if (!p?.prompt && !p?.completion) return null;

  const inCost = (p.prompt ?? 0) * usage.inputTokens;
  const outCost = (p.completion ?? 0) * usage.outputTokens;
  const total = inCost + outCost;
  return Number.isFinite(total) ? total : null;
}

export async function aggregateCostsFromSessions({
  openclawDir = '/root/.openclaw',
  days = 30,
}: {
  openclawDir?: string;
  days?: number;
}) {
  const [usages, pricingMap] = await Promise.all([
    readAllSessionUsages(openclawDir),
    fetchOpenRouterPricingMap().catch(() => new Map()),
  ]);

  const now = Date.now();
  const cutoff = now - days * 24 * 60 * 60 * 1000;

  const todayStart = startOfDayUTC(now);
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

  const thisMonth = ymUTC(now);
  const lastMonth = (() => {
    const d = new Date(now);
    d.setUTCMonth(d.getUTCMonth() - 1);
    return ymUTC(d.getTime());
  })();

  let today = 0;
  let yesterday = 0;
  let thisMonthCost = 0;
  let lastMonthCost = 0;

  let missingPricingSessions = 0;
  let missingPricingTokens = 0;

  const byAgent = new Map<string, CostRow>();
  const byModel = new Map<string, CostRow>();
  const daily = new Map<string, CostRow>();
  const hourly = new Map<string, CostRow>();

  for (const u of usages) {
    const cost = computeCostFor(u, pricingMap);
    const tokens = u.inputTokens + u.outputTokens;

    if (cost == null) {
      missingPricingSessions++;
      missingPricingTokens += tokens;
      continue;
    }

    const dayBucketTs = startOfDayUTC(u.updatedAt);

    if (dayBucketTs >= todayStart) today += cost;
    else if (dayBucketTs >= yesterdayStart && dayBucketTs < todayStart) yesterday += cost;

    const ym = ymUTC(u.updatedAt);
    if (ym === thisMonth) thisMonthCost += cost;
    if (ym === lastMonth) lastMonthCost += cost;

    if (u.updatedAt >= cutoff) {
      const agentRow = byAgent.get(u.agentId) ?? { cost: 0, tokens: 0, input: 0, output: 0 };
      agentRow.cost += cost;
      agentRow.tokens += tokens;
      agentRow.input += u.inputTokens;
      agentRow.output += u.outputTokens;
      byAgent.set(u.agentId, agentRow);

      const modelKey = normalizeModelId(u.modelId);
      const modelRow = byModel.get(modelKey) ?? { cost: 0, tokens: 0, input: 0, output: 0 };
      modelRow.cost += cost;
      modelRow.tokens += tokens;
      modelRow.input += u.inputTokens;
      modelRow.output += u.outputTokens;
      byModel.set(modelKey, modelRow);

      const dayKey = formatDayUTC(u.updatedAt);
      const dayRow = daily.get(dayKey) ?? { cost: 0, tokens: 0, input: 0, output: 0 };
      dayRow.cost += cost;
      dayRow.tokens += tokens;
      dayRow.input += u.inputTokens;
      dayRow.output += u.outputTokens;
      daily.set(dayKey, dayRow);

      const hourKey = hourUTC(u.updatedAt);
      const hourRow = hourly.get(hourKey) ?? { cost: 0, tokens: 0, input: 0, output: 0 };
      hourRow.cost += cost;
      hourRow.tokens += tokens;
      hourly.set(hourKey, hourRow);
    }
  }

  // Project end-of-month based on average daily cost so far in this month.
  const dNow = new Date(now);
  const dayOfMonth = dNow.getUTCDate();
  const daysInMonth = new Date(Date.UTC(dNow.getUTCFullYear(), dNow.getUTCMonth() + 1, 0)).getUTCDate();
  const avg = dayOfMonth > 0 ? thisMonthCost / dayOfMonth : 0;
  const projected = avg * daysInMonth;

  return {
    today,
    yesterday,
    thisMonth: thisMonthCost,
    lastMonth: lastMonthCost,
    projected,
    byAgent: Array.from(byAgent.entries())
      .map(([agent, row]) => ({ agent, cost: row.cost, tokens: row.tokens }))
      .sort((a, b) => b.cost - a.cost),
    byModel: Array.from(byModel.entries())
      .map(([model, row]) => ({ model, cost: row.cost, tokens: row.tokens }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 12),
    daily: Array.from(daily.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, row]) => ({ date, cost: row.cost, input: row.input, output: row.output })),
    hourly: Array.from({ length: 24 }, (_, h) => {
      const key = String(h).padStart(2, '0');
      return { hour: key, cost: hourly.get(key)?.cost ?? 0 };
    }),
    meta: {
      sessionsScanned: usages.length,
      missingPricingSessions,
      missingPricingTokens,
    },
  };
}
