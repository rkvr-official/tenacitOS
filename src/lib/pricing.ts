/**
 * OpenClaw Model Pricing
 * Based on OpenRouter and Anthropic pricing as of Feb 2026
 * All prices in USD per million tokens
 */

export interface ModelPricing {
  id: string;
  name: string;
  alias?: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  contextWindow: number;
  source?: string;
}

export const MODEL_PRICING: ModelPricing[] = [
  // Anthropic models
  {
    id: "anthropic/claude-opus-4-6",
    name: "Opus 4.6",
    alias: "opus",
    inputPricePerMillion: 15.00,
    outputPricePerMillion: 75.00,
    contextWindow: 200000,
  },
  {
    id: "anthropic/claude-sonnet-4-5",
    name: "Sonnet 4.5",
    alias: "sonnet",
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00,
    contextWindow: 200000,
  },
  {
    id: "anthropic/claude-haiku-3-5",
    name: "Haiku 3.5",
    alias: "haiku",
    inputPricePerMillion: 0.80,
    outputPricePerMillion: 4.00,
    contextWindow: 200000,
  },
  // Google Gemini models
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini Flash",
    alias: "gemini-flash",
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.60,
    contextWindow: 1000000,
  },
  {
    id: "google/gemini-2.5-pro",
    name: "Gemini Pro",
    alias: "gemini-pro",
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 5.00,
    contextWindow: 2000000,
  },
  // X.AI Grok
  {
    id: "x-ai/grok-4-1-fast",
    name: "Grok 4.1 Fast",
    inputPricePerMillion: 2.00,
    outputPricePerMillion: 10.00,
    contextWindow: 128000,
  },
  // MiniMax
  {
    id: "minimax/minimax-m2.5",
    name: "MiniMax M2.5",
    alias: "minimax",
    inputPricePerMillion: 0.30,
    outputPricePerMillion: 1.10,
    contextWindow: 1000000,
  },
  // OpenAI (official rates supplied by user from OpenAI pricing docs)
  { id: "openai/gpt-5.2", name: "GPT-5.2", alias: "gpt-5.2", inputPricePerMillion: 1.75, outputPricePerMillion: 14.00, contextWindow: 400000, source: "openai-doc" },
  { id: "openai/gpt-5.1", name: "GPT-5.1", alias: "gpt-5.1", inputPricePerMillion: 1.25, outputPricePerMillion: 10.00, contextWindow: 400000, source: "openai-doc" },
  { id: "openai/gpt-5", name: "GPT-5", alias: "gpt-5", inputPricePerMillion: 1.25, outputPricePerMillion: 10.00, contextWindow: 400000, source: "openai-doc" },
  { id: "openai/gpt-5-mini", name: "GPT-5 Mini", alias: "gpt-5-mini", inputPricePerMillion: 0.25, outputPricePerMillion: 2.00, contextWindow: 400000, source: "openai-doc" },
  { id: "openai/gpt-5-nano", name: "GPT-5 Nano", alias: "gpt-5-nano", inputPricePerMillion: 0.05, outputPricePerMillion: 0.40, contextWindow: 400000, source: "openai-doc" },
  { id: "openai/gpt-5.2-chat-latest", name: "GPT-5.2 Chat", inputPricePerMillion: 1.75, outputPricePerMillion: 14.00, contextWindow: 128000, source: "openai-doc" },
  { id: "openai/gpt-5.1-chat-latest", name: "GPT-5.1 Chat", inputPricePerMillion: 1.25, outputPricePerMillion: 10.00, contextWindow: 128000, source: "openai-doc" },
  { id: "openai/gpt-5-chat-latest", name: "GPT-5 Chat", inputPricePerMillion: 1.25, outputPricePerMillion: 10.00, contextWindow: 128000, source: "openai-doc" },
  { id: "openai/gpt-5.2-codex", name: "GPT-5.2 Codex", inputPricePerMillion: 1.75, outputPricePerMillion: 14.00, contextWindow: 400000, source: "openai-doc" },
  { id: "openai/gpt-5.1-codex-max", name: "GPT-5.1 Codex Max", inputPricePerMillion: 1.25, outputPricePerMillion: 10.00, contextWindow: 400000, source: "openai-doc" },
  { id: "openai/gpt-5-codex", name: "GPT-5 Codex", inputPricePerMillion: 1.25, outputPricePerMillion: 10.00, contextWindow: 400000, source: "openai-doc" },
  { id: "openai-codex/gpt-5.3-codex", name: "GPT-5.3 Codex", alias: "gpt-5.3-codex", inputPricePerMillion: 1.75, outputPricePerMillion: 14.00, contextWindow: 272000, source: "openai-doc" },
  { id: "openai/gpt-4.1", name: "GPT-4.1", alias: "gpt-4.1", inputPricePerMillion: 2.00, outputPricePerMillion: 8.00, contextWindow: 1047576, source: "openai-doc" },
  { id: "openai/gpt-4.1-mini", name: "GPT-4.1 Mini", alias: "gpt-4.1-mini", inputPricePerMillion: 0.40, outputPricePerMillion: 1.60, contextWindow: 1047576, source: "openai-doc" },
  { id: "openai/gpt-4.1-nano", name: "GPT-4.1 Nano", alias: "gpt-4.1-nano", inputPricePerMillion: 0.10, outputPricePerMillion: 0.40, contextWindow: 1047576, source: "openai-doc" },
  { id: "openai/gpt-4o", name: "GPT-4o", alias: "gpt-4o", inputPricePerMillion: 2.50, outputPricePerMillion: 10.00, contextWindow: 128000, source: "openai-doc" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", alias: "gpt-4o-mini", inputPricePerMillion: 0.15, outputPricePerMillion: 0.60, contextWindow: 128000, source: "openai-doc" },
  { id: "openai/o1", name: "o1", alias: "o1", inputPricePerMillion: 15.00, outputPricePerMillion: 60.00, contextWindow: 200000, source: "openai-doc" },
  { id: "openai/o3", name: "o3", alias: "o3", inputPricePerMillion: 2.00, outputPricePerMillion: 8.00, contextWindow: 200000, source: "openai-doc" },
  { id: "openai/o3-mini", name: "o3-mini", alias: "o3-mini", inputPricePerMillion: 1.10, outputPricePerMillion: 4.40, contextWindow: 200000, source: "openai-doc" },
  { id: "openai/o4-mini", name: "o4-mini", alias: "o4-mini", inputPricePerMillion: 1.10, outputPricePerMillion: 4.40, contextWindow: 200000, source: "openai-doc" },
];

/**
 * Calculate cost for a given model and token usage
 */
export function calculateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING.find(
    (p) => p.id === modelId || p.alias === modelId
  );

  if (!pricing) {
    const m = (modelId || '').toLowerCase();
    let input = 3.0;
    let output = 15.0;
    if (m.startsWith('google/')) { input = 0.35; output = 1.5; }
    else if (m.startsWith('anthropic/')) { input = 3.0; output = 15.0; }
    else if (m.startsWith('openrouter/')) { input = 0.5; output = 2.0; }
    else if (m.startsWith('openai/') || m.startsWith('openai-codex/')) { input = 3.0; output = 15.0; }
    else console.warn(`Unknown model: ${modelId}, using default pricing`);
    return (inputTokens / 1_000_000) * input + (outputTokens / 1_000_000) * output;
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPricePerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPricePerMillion;

  return inputCost + outputCost;
}

/**
 * Get human-readable model name
 */
export function getModelName(modelId: string): string {
  const pricing = MODEL_PRICING.find(
    (p) => p.id === modelId || p.alias === modelId
  );
  return pricing?.name || modelId;
}

export function getModelPricing(modelId: string): ModelPricing | null {
  const normalized = normalizeModelId(modelId);
  return MODEL_PRICING.find((p) => p.id === normalized || p.alias === modelId || p.id === modelId) || null;
}

/**
 * Normalize model ID (handle aliases and different formats)
 */
export function normalizeModelId(modelId: string): string {
  // Handle short aliases and OpenClaw format (without provider prefix)
  const aliasMap: Record<string, string> = {
    // Short aliases
    opus: "anthropic/claude-opus-4-6",
    sonnet: "anthropic/claude-sonnet-4-5",
    haiku: "anthropic/claude-haiku-3-5",
    "gemini-flash": "google/gemini-2.5-flash",
    "gemini-pro": "google/gemini-2.5-pro",
    // OpenClaw format (without provider/)
    "claude-opus-4-6": "anthropic/claude-opus-4-6",
    "claude-sonnet-4-5": "anthropic/claude-sonnet-4-5",
    "claude-haiku-3-5": "anthropic/claude-haiku-3-5",
    "gemini-2.5-flash": "google/gemini-2.5-flash",
    "gemini-2.5-pro": "google/gemini-2.5-pro",
    // MiniMax
    minimax: "minimax/minimax-m2.5",
    "minimax-m2.5": "minimax/minimax-m2.5",
    // OpenAI aliases
    "gpt-5": "openai/gpt-5",
    "gpt-5.2": "openai/gpt-5.2",
    "gpt-5.3-codex": "openai/gpt-5.3-codex",
  };


  if (aliasMap[modelId]) return aliasMap[modelId];

  // Heuristic normalization for short ids
  const lower = (modelId || '').toLowerCase();
  if (!modelId.includes('/')) {
    if (lower.startsWith('gpt-') || lower.startsWith('o1') || lower.startsWith('o3') || lower.startsWith('o4')) {
      return `openai/${modelId}`;
    }
    if (lower.startsWith('gemini-')) {
      return `google/${modelId}`;
    }
  }

  return modelId;
}
