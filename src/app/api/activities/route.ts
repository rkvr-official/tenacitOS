import { NextRequest, NextResponse } from 'next/server';
import { logActivity, getActivities } from '@/lib/activities-db';
import { getOpenclawDerivedActivities, type DerivedActivity } from '@/lib/openclaw-activity';

type SortOrder = 'newest' | 'oldest';

function applyFilters(items: DerivedActivity[], opts: {
  type?: string;
  status?: string;
  agent?: string;
  startDate?: string;
  endDate?: string;
}) {
  return items.filter((a) => {
    if (opts.type && opts.type !== 'all') {
      const types = opts.type.split(',').map((t) => t.trim()).filter(Boolean);
      if (types.length && !types.includes(a.type)) return false;
    }

    if (opts.status && opts.status !== 'all' && a.status !== opts.status) return false;
    if (opts.agent && a.agent !== opts.agent) return false;

    if (opts.startDate) {
      const start = new Date(opts.startDate).getTime();
      if (new Date(a.timestamp).getTime() < start) return false;
    }

    if (opts.endDate) {
      const end = new Date(opts.endDate);
      end.setHours(23, 59, 59, 999);
      if (new Date(a.timestamp).getTime() > end.getTime()) return false;
    }

    return true;
  });
}

function sortByTimestamp(items: DerivedActivity[], sort: SortOrder) {
  return items.sort((a, b) => {
    const ta = new Date(a.timestamp).getTime();
    const tb = new Date(b.timestamp).getTime();
    return sort === 'oldest' ? ta - tb : tb - ta;
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const type = searchParams.get('type') || undefined;
    const status = searchParams.get('status') || undefined;
    const agent = searchParams.get('agent') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const sort = (searchParams.get('sort') || 'newest') as SortOrder;
    const format = searchParams.get('format') || 'json';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), format === 'csv' ? 10000 : 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    // 1) DB-backed activities (high cap), then paginate after merge
    const dbResult = getActivities({
      type,
      status,
      agent,
      startDate,
      endDate,
      sort,
      limit: format === 'csv' ? 10000 : 1200,
      offset: 0,
    });

    // 2) OpenClaw-derived activities
    const derivedRaw = getOpenclawDerivedActivities();
    const derived = applyFilters(derivedRaw, { type, status, agent, startDate, endDate });

    const mergedMap = new Map<string, DerivedActivity>();

    for (const d of derived) mergedMap.set(d.id, d);
    for (const a of dbResult.activities) {
      mergedMap.set(a.id, {
        id: a.id,
        timestamp: a.timestamp,
        type: a.type,
        description: a.description,
        status: a.status,
        duration_ms: a.duration_ms,
        tokens_used: a.tokens_used,
        agent: (a as any).agent ?? null,
        metadata: a.metadata ?? null,
      });
    }

    const merged = sortByTimestamp(Array.from(mergedMap.values()), sort);
    const total = merged.length;
    const activities = merged.slice(offset, offset + limit);

    // CSV export
    if (format === 'csv') {
      const header = 'id,timestamp,type,description,status,duration_ms,tokens_used,agent\n';
      const rows = activities.map((a) => [
        a.id,
        a.timestamp,
        a.type,
        `"${(a.description || '').replace(/"/g, '""')}"`,
        a.status,
        a.duration_ms ?? '',
        a.tokens_used ?? '',
        a.agent ?? '',
      ].join(',')).join('\n');
      const csv = header + rows;
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="activities-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    return NextResponse.json({
      activities,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    console.error('Failed to get activities:', error);
    return NextResponse.json({ error: 'Failed to get activities' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.type || !body.description || !body.status) {
      return NextResponse.json(
        { error: 'Missing required fields: type, description, status' },
        { status: 400 }
      );
    }

    const validStatuses = ['success', 'error', 'pending', 'running'];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const activity = logActivity(body.type, body.description, body.status, {
      duration_ms: body.duration_ms ?? null,
      tokens_used: body.tokens_used ?? null,
      agent: body.agent ?? null,
      metadata: body.metadata ?? null,
    });

    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    console.error('Failed to save activity:', error);
    return NextResponse.json({ error: 'Failed to save activity' }, { status: 500 });
  }
}
