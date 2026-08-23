import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config } from './config';

// Global connection pool singleton for Next.js hot reloading
declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __pgHealthCache: { ok: boolean; timestamp: number } | undefined;
}

function createPool(): Pool {
  return new Pool({
    connectionString: config.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 500, // Fast 500ms connection timeout
  });
}

export const pool: Pool = global.__pgPool || createPool();

if (process.env.NODE_ENV !== 'production') {
  global.__pgPool = pool;
}

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  try {
    const res = await pool.query<T>(text, params);
    return res;
  } catch (error) {
    console.error('[DB Query Error]', { text, error });
    throw error;
  }
}

export async function getClient(): Promise<PoolClient> {
  return await pool.connect();
}

const HEALTH_CACHE_TTL_MS = 60000; // Cache DB connection status for 60 seconds

export async function checkDbConnection(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  const now = Date.now();
  const cached = global.__pgHealthCache;

  if (cached && now - cached.timestamp < HEALTH_CACHE_TTL_MS) {
    return { ok: cached.ok };
  }

  // If no external DATABASE_URL is configured or contains localhost defaults when offline
  if (!config.databaseUrl || config.databaseUrl.includes('placeholder')) {
    global.__pgHealthCache = { ok: false, timestamp: now };
    return { ok: false, error: 'No database URL configured' };
  }

  try {
    const start = Date.now();
    // Fast 150ms race to prevent any request latency
    const res = (await Promise.race([
      pool.query('SELECT 1 as health'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('DB Timeout')), 150)),
    ])) as any;

    if (res.rows?.[0]?.health === 1) {
      global.__pgHealthCache = { ok: true, timestamp: now };
      return { ok: true, latencyMs: Date.now() - start };
    }

    global.__pgHealthCache = { ok: false, timestamp: now };
    return { ok: false, error: 'Unexpected response from database query' };
  } catch (error: any) {
    global.__pgHealthCache = { ok: false, timestamp: now };
    return { ok: false, error: error?.message || String(error) };
  }
}
