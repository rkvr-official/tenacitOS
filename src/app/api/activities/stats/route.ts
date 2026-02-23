/**
 * Activity Stats API
 * GET /api/activities/stats
 * Returns heatmap data, counts by type, status, and recent trend
 */
import { NextResponse } from 'next/server';
import { getActivities } from '@/lib/activities-db';
import { getOpenclawDerivedActivities } from '@/lib/openclaw-activity';

export const dynamic = 'force-dynamic';

interface ActivityLike {
  id: string;
  timestamp: string;
  type: string;
  status: string;
}

function dateKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export async function GET() {
  try {
    const db = getActivities({ limit: 2500, offset: 0, sort: 'newest' }).activities;
    const derived = getOpenclawDerivedActivities();

    const map = new Map<string, ActivityLike>();
    for (const a of derived) map.set(a.id, { id: a.id, timestamp: a.timestamp, type: a.type, status: a.status });
    for (const a of db) map.set(a.id, { id: a.id, timestamp: a.timestamp, type: a.type, status: a.status });

    const items = Array.from(map.values());
    const now = Date.now();
    const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const heatmapMap = new Map<string, number>();
    const trendMap = new Map<string, { day: string; count: number; success: number; errors: number }>();
    const hourlyMap = new Map<string, number>();

    let today = 0;
    const todayKey = new Date().toISOString().slice(0, 10);

    for (const a of items) {
      const ts = new Date(a.timestamp).getTime();
      const day = dateKey(a.timestamp);

      byType[a.type] = (byType[a.type] || 0) + 1;
      byStatus[a.status] = (byStatus[a.status] || 0) + 1;

      if (day === todayKey) today += 1;

      if (ts >= oneYearAgo) {
        heatmapMap.set(day, (heatmapMap.get(day) || 0) + 1);
      }

      if (ts >= sevenDaysAgo) {
        const prev = trendMap.get(day) || { day, count: 0, success: 0, errors: 0 };
        prev.count += 1;
        if (a.status === 'success') prev.success += 1;
        if (a.status === 'error') prev.errors += 1;
        trendMap.set(day, prev);
      }

      if (ts >= thirtyDaysAgo) {
        const hour = new Date(a.timestamp).getHours().toString().padStart(2, '0');
        hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
      }
    }

    const heatmap = Array.from(heatmapMap.entries())
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => a.day.localeCompare(b.day));

    const trend = Array.from(trendMap.values()).sort((a, b) => b.day.localeCompare(a.day));

    const hourly = Array.from(hourlyMap.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      total: items.length,
      today,
      byType,
      byStatus,
      heatmap,
      trend,
      hourly,
    });
  } catch (error) {
    console.error('[activities/stats] Error:', error);
    return NextResponse.json({ error: 'Failed to get stats' }, { status: 500 });
  }
}
