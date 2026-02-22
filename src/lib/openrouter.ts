import fs from 'fs/promises';
import path from 'path';

export type OpenRouterModelPricing = {
  prompt?: number; // per token USD
  completion?: number; // per token USD
};

export type OpenRouterModel = {
  id: string;
  name?: string;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
};

let cached: { ts: number; models: Map<string, OpenRouterModelPricing> } | null = null;
const CACHE_MS = 6 * 60 * 60 * 1000; // 6h

export function normalizeModelId(modelId: string): string {
  // OpenClaw config sometimes prefixes openrouter/ or uses provider wrappers.
  if (modelId.startsWith('openrouter/')) return modelId.slice('openrouter/'.length);
  if (modelId.startsWith('openai-codex/')) return `openai/${modelId.slice('openai-codex/'.length)}`;
  return modelId;
}

export async function fetchOpenRouterPricingMap(): Promise<Map<string, OpenRouterModelPricing>> {
  if (cached && Date.now() - cached.ts < CACHE_MS) return cached.models;

  const res = await fetch('https://openrouter.ai/api/v1/models', {
    // Next.js fetch caching can be surprising; keep it explicit.
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`OpenRouter models fetch failed: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as { data?: OpenRouterModel[] };
  const models = new Map<string, OpenRouterModelPricing>();

  for (const m of json?.data ?? []) {
    const prompt = m?.pricing?.prompt != null ? Number(m.pricing.prompt) : undefined;
    const completion = m?.pricing?.completion != null ? Number(m.pricing.completion) : undefined;

    models.set(m.id, {
      prompt: Number.isFinite(prompt as number) ? (prompt as number) : undefined,
      completion: Number.isFinite(completion as number) ? (completion as number) : undefined,
    });
  }

  cached = { ts: Date.now(), models };
  return models;
}

export async function readOpenClawJson(openclawDir = '/root/.openclaw') {
  const file = path.join(openclawDir, 'openclaw.json');
  const raw = await fs.readFile(file, 'utf8');
  return JSON.parse(raw) as any;
}

export async function getSelectedModelIdsFromOpenClaw(openclawDir = '/root/.openclaw'): Promise<string[]> {
  const cfg = await readOpenClawJson(openclawDir);
  const modelsObj = cfg?.agents?.defaults?.models;
  const ids = modelsObj && typeof modelsObj === 'object' ? Object.keys(modelsObj) : [];
  // stable order
  return ids.sort();
}
