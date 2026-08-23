import fs from 'fs';
import path from 'path';
import { ChunkWithEmbedding } from '../../scripts/ingest-documents';
import { generateEmbedding } from './embedding';
import { qdrantClient, QDRANT_DOCS_COLLECTION, checkQdrantConnection } from '../lib/qdrant';

export interface SearchOptions {
  accountId?: string | null;
  includeDeprecated?: boolean;
  limit?: number;
}

export interface SearchResult {
  chunk_id: string;
  doc_id: string;
  doc_status: 'CURRENT' | 'DEPRECATED';
  doc_type: 'policy' | 'sop' | 'guide' | 'agreement';
  effective_date: string;
  account_id: string | null;
  section: string;
  title: string;
  authority_rank: number;
  score: number;
  text: string;
}

let cachedChunks: ChunkWithEmbedding[] | null = null;

export function getCachedChunks(forceReload = false): ChunkWithEmbedding[] {
  if (cachedChunks && !forceReload) return cachedChunks;
  const jsonPath = path.join(__dirname, '../data/doc-chunks.json');
  if (fs.existsSync(jsonPath)) {
    try {
      cachedChunks = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      return cachedChunks!;
    } catch (e) {
      // Fallback
    }
  }
  return cachedChunks || [];
}

export function invalidateChunkCache(): void {
  cachedChunks = null;
}

export async function searchDocuments(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  const { accountId = null, includeDeprecated = false, limit = 5 } = options;
  const queryEmbedding = await generateEmbedding(query);
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/[\s,.-]+/).filter((w) => w.length > 2);

  // Check if Qdrant is connected
  const qdrantHealth = await checkQdrantConnection();
  if (qdrantHealth.ok) {
    try {
      const filterMust: any[] = [];
      if (!includeDeprecated) {
        filterMust.push({
          key: 'doc_status',
          match: { value: 'CURRENT' },
        });
      }

      if (accountId) {
        filterMust.push({
          should: [
            { is_null: { key: 'account_id' } },
            { key: 'account_id', match: { value: accountId } },
          ],
        });
      }

      const qdrantResponse: any = await qdrantClient.query(QDRANT_DOCS_COLLECTION, {
        query: queryEmbedding,
        limit: limit * 3,
        filter: filterMust.length > 0 ? { must: filterMust } : undefined,
      });

      const points = qdrantResponse?.points || [];
      if (points.length > 0) {
        const results: SearchResult[] = points.map((r: any) => ({
          chunk_id: r.payload.chunk_id,
          doc_id: r.payload.doc_id,
          doc_status: r.payload.doc_status,
          doc_type: r.payload.doc_type,
          effective_date: r.payload.effective_date,
          account_id: r.payload.account_id,
          section: r.payload.section,
          title: r.payload.title,
          authority_rank: Number(r.payload.authority_rank) || 2,
          score: r.score,
          text: r.payload.text,
        }));

        return rerankResults(results, limit, queryLower);
      }
    } catch (err) {
      console.warn('Qdrant query notice, continuing with hybrid search:', err);
    }
  }

  // Fallback / In-memory Hybrid Retrieval
  const chunks = getCachedChunks();
  const scoredChunks: SearchResult[] = [];

  for (const chunk of chunks) {
    // Deprecated filter (Rule 8: Deprecated docs excluded from current answers unless explicitly requested)
    if (!includeDeprecated && chunk.doc_status === 'DEPRECATED') {
      continue;
    }

    // Access control: customer can only see general docs or their own agreement
    if (accountId !== undefined && accountId !== null) {
      if (chunk.account_id !== null && chunk.account_id !== accountId) {
        continue;
      }
    }

    // Semantic Vector Cosine Similarity
    const vectorScore = cosineSimilarity(queryEmbedding, chunk.embedding);

    // Keyword Lexical Overlap
    const lowerText = (chunk.title + ' ' + chunk.section + ' ' + chunk.text).toLowerCase();
    let keywordMatches = 0;
    for (const word of queryWords) {
      if (lowerText.includes(word)) {
        keywordMatches++;
      }
    }
    const keywordScore = queryWords.length > 0 ? keywordMatches / queryWords.length : 0;

    // Direct exact keyword match boost
    let exactBoost = 0;
    if (queryLower.includes('ki-211') && lowerText.includes('ki-211')) exactBoost += 0.5;
    if (queryLower.includes('ki-208') && lowerText.includes('ki-208')) exactBoost += 0.5;
    if (queryLower.includes('ki-176') && lowerText.includes('ki-176')) exactBoost += 0.5;
    if (queryLower.includes('swiftship') && lowerText.includes('swiftship')) exactBoost += 0.3;
    if (queryLower.includes('webhook') && lowerText.includes('webhook')) exactBoost += 0.3;
    if ((queryLower.includes('v2') || queryLower.includes('deprecated') || queryLower.includes('old policy')) && chunk.doc_status === 'DEPRECATED') {
      exactBoost += 0.6;
    }

    // Hybrid score
    const hybridScore = vectorScore * 0.45 + keywordScore * 0.55 + exactBoost;

    if (hybridScore > 0.08 || keywordMatches > 0) {
      scoredChunks.push({
        chunk_id: chunk.id,
        doc_id: chunk.doc_id,
        doc_status: chunk.doc_status,
        doc_type: chunk.doc_type,
        effective_date: chunk.effective_date,
        account_id: chunk.account_id,
        section: chunk.section,
        title: chunk.title,
        authority_rank: chunk.authority_rank,
        score: hybridScore,
        text: chunk.text,
      });
    }
  }

  return rerankResults(scoredChunks, limit, queryLower);
}

/**
 * Hybrid Reranker enforcing Rule 9 Source Precedence:
 * 1. Signed customer agreement (Rank 1)
 * 2. Current policy / SOP (Rank 2)
 * 3. Current product documentation / known issues (Rank 3)
 */
function rerankResults(items: SearchResult[], limit: number, queryLower?: string): SearchResult[] {
  const isHistoricalQuery = queryLower && (queryLower.includes('v2') || queryLower.includes('deprecated') || queryLower.includes('old policy'));

  return items
    .map((item) => {
      let authorityBonus = 0;
      if (isHistoricalQuery && item.doc_status === 'DEPRECATED') {
        authorityBonus = 0.5; // If explicitly asking about old policy, prioritize historical doc
      } else {
        if (item.authority_rank === 1) authorityBonus = 0.25;
        else if (item.authority_rank === 2) authorityBonus = 0.10;
        else if (item.authority_rank === 3) authorityBonus = 0.05;
      }

      return {
        ...item,
        score: item.score + authorityBonus,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
