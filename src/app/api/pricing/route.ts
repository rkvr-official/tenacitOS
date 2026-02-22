import { NextResponse } from 'next/server';
import { fetchOpenRouterPricingMap, getSelectedModelIdsFromOpenClaw, normalizeModelId } from '@/lib/openrouter';

export async function GET() {
  try {
    const [selected, pricing] = await Promise.all([
      getSelectedModelIdsFromOpenClaw('/root/.openclaw'),
      fetchOpenRouterPricingMap(),
    ]);

    const models = selected.map((rawId) => {
      const id = normalizeModelId(rawId);
      const p = pricing.get(id);

      const inPerToken = p?.prompt;
      const outPerToken = p?.completion;

      return {
        id: rawId,
        normalizedId: id,
        inputPer1M: inPerToken != null ? inPerToken * 1_000_000 : null,
        outputPer1M: outPerToken != null ? outPerToken * 1_000_000 : null,
        source: p ? 'openrouter' : 'unknown',
      };
    });

    return NextResponse.json({ models, count: models.length });
  } catch (e) {
    console.error('[pricing] error', e);
    return NextResponse.json({ models: [], count: 0, error: 'Failed to load pricing' }, { status: 500 });
  }
}
