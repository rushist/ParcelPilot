import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from './config';

export const qdrantClient = new QdrantClient({
  url: config.qdrantUrl,
  apiKey: config.qdrantApiKey || undefined,
});

export const QDRANT_DOCS_COLLECTION = 'parcelpilot_docs';

export async function checkQdrantConnection(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  const start = Date.now();
  try {
    const collections = await qdrantClient.getCollections();
    const latencyMs = Date.now() - start;
    return { ok: true, latencyMs };
  } catch (error: any) {
    return { ok: false, error: error?.message || String(error) };
  }
}
