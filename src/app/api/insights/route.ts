import { NextRequest, NextResponse } from 'next/server';
import { getInsights, InsightQueryType } from '@/insights';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const queryType = (searchParams.get('type') || 'spike_by_topic') as InsightQueryType;
    const kiId = searchParams.get('ki_id') || undefined;
    const thresholdPct = Number(searchParams.get('threshold_pct')) || 80;
    const minCount = Number(searchParams.get('min_count')) || 2;

    const result = await getInsights(queryType, {
      ki_id: kiId,
      threshold_pct: thresholdPct,
      min_count: minCount,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
