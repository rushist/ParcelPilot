import { NextResponse } from 'next/server';
import { checkDbConnection } from '@/lib/db';
import { checkQdrantConnection } from '@/lib/qdrant';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();

  const [dbResult, qdrantResult] = await Promise.all([
    checkDbConnection(),
    checkQdrantConnection(),
  ]);

  const isHealthy = dbResult.ok && qdrantResult.ok;
  const isDegraded = dbResult.ok || qdrantResult.ok;

  const responseStatus = isHealthy ? 'ok' : isDegraded ? 'degraded' : 'error';
  const httpStatus = isHealthy ? 200 : 503;

  return NextResponse.json(
    {
      status: responseStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      database: {
        status: dbResult.ok ? 'connected' : 'disconnected',
        latencyMs: dbResult.latencyMs,
        error: dbResult.error,
      },
      qdrant: {
        status: qdrantResult.ok ? 'connected' : 'disconnected',
        latencyMs: qdrantResult.latencyMs,
        error: qdrantResult.error,
      },
    },
    { status: httpStatus }
  );
}
