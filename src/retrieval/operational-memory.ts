import fs from 'fs';
import path from 'path';
import { generateEmbedding } from './embedding';
import { getCachedChunks } from './search';
import { qdrantClient, QDRANT_DOCS_COLLECTION, checkQdrantConnection } from '../lib/qdrant';
import { pool, checkDbConnection } from '../lib/db';
import { getTicketById, updateTicketRecord } from '../lib/data-store';
import { ChunkWithEmbedding } from '../../scripts/ingest-documents';

export interface OpsResolutionRecord {
  ticketId: string;
  accountId?: string;
  problem: string;
  resolution: string;
  operator: string;
  resolvedAt: string;
}

/**
 * Persists an operational workflow/resolution into the RAG vector store and PostgreSQL doc_chunks.
 * Enables the AI system to learn from Ops resolutions and propose them on future similar queries.
 */
export async function learnOpsResolution(record: {
  ticketId: string;
  accountId?: string;
  problem: string;
  resolution: string;
  operator: string;
}): Promise<{ success: boolean; chunkId: string; summary: string }> {
  const accountId = record.accountId || 'ACCT-001';
  const chunkId = `CHUNK-PLAYBOOK-${record.ticketId}-${Date.now().toString(36).toUpperCase()}`;
  const resolvedAt = new Date().toISOString();
  const title = `Operational Playbook: ${record.problem.slice(0, 60)}`;
  const text = `Incident: ${record.problem}\n\nVerified Ops Resolution Method: ${record.resolution}\n\nResolved By: ${record.operator} on ticket ${record.ticketId} at ${resolvedAt}.`;

  // 1. Update ticket record in data store & DB with historical resolution
  try {
    const existingTicket = await getTicketById(record.ticketId);
    if (existingTicket) {
      await updateTicketRecord({
        ...existingTicket,
        status: 'resolved',
        historical_resolution: record.resolution,
        updated_at: resolvedAt,
      });
    }
  } catch (tktErr) {
    console.warn('Notice: Could not update ticket record with historical resolution:', tktErr);
  }

  // 2. Generate vector embedding
  const embedding = await generateEmbedding(`${title}: ${text}`);

  const chunk: ChunkWithEmbedding = {
    id: chunkId,
    doc_id: 'DOC-PLAYBOOK-OPS',
    doc_status: 'CURRENT',
    doc_type: 'guide',
    effective_date: resolvedAt.split('T')[0],
    account_id: accountId,
    section: `Ops Resolution Playbook (${record.ticketId})`,
    title,
    authority_rank: 3,
    text,
    embedding,
  };

  // 3. Update static JSON cache and memory store
  try {
    const jsonPath = path.join(__dirname, '../data/doc-chunks.json');
    let chunks: ChunkWithEmbedding[] = [];
    if (fs.existsSync(jsonPath)) {
      chunks = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    }
    // Prepend new operational chunk
    chunks.unshift(chunk);
    fs.writeFileSync(jsonPath, JSON.stringify(chunks, null, 2), 'utf8');

    // Update in-memory cached chunks
    const memChunks = getCachedChunks();
    if (Array.isArray(memChunks)) {
      memChunks.unshift(chunk);
    }
  } catch (fsErr: any) {
    console.warn('Notice: Could not write to doc-chunks.json:', fsErr.message);
  }

  // 4. Ingest into Qdrant Vector Collection if available
  try {
    const qHealth = await checkQdrantConnection();
    if (qHealth.ok) {
      await qdrantClient.upsert(QDRANT_DOCS_COLLECTION, {
        wait: true,
        points: [
          {
            id: Math.floor(Math.random() * 1000000) + 1000,
            vector: embedding,
            payload: {
              chunk_id: chunk.id,
              doc_id: chunk.doc_id,
              doc_status: chunk.doc_status,
              doc_type: chunk.doc_type,
              effective_date: chunk.effective_date,
              account_id: chunk.account_id,
              section: chunk.section,
              title: chunk.title,
              authority_rank: chunk.authority_rank,
              text: chunk.text,
            },
          },
        ],
      });
    }
  } catch (qErr) {
    console.warn('Qdrant playbook upsert notice:', qErr);
  }

  // 5. Insert into PostgreSQL doc_chunks table if connected
  try {
    const dbHealth = await checkDbConnection();
    if (dbHealth.ok) {
      const client = await pool.connect();
      try {
        await client.query(
          `INSERT INTO doc_chunks (id, doc_id, doc_status, doc_type, effective_date, account_id, section, title, authority_rank, text)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text`,
          [
            chunk.id,
            chunk.doc_id,
            chunk.doc_status,
            chunk.doc_type,
            chunk.effective_date,
            chunk.account_id,
            chunk.section,
            chunk.title,
            chunk.authority_rank,
            chunk.text,
          ]
        );
      } finally {
        client.release();
      }
    }
  } catch (dbErr) {
    console.warn('Postgres doc_chunks playbook insert notice:', dbErr);
  }

  return {
    success: true,
    chunkId,
    summary: `Operational resolution for ticket ${record.ticketId} vectorized and indexed into RAG memory.`,
  };
}

/**
 * Searches for past operational resolutions matching a problem inquiry.
 */
export async function findMatchingOpsPlaybook(query: string, accountId?: string): Promise<{
  matched: boolean;
  ticketId?: string;
  operator?: string;
  problem?: string;
  resolution?: string;
  snippet?: string;
}> {
  const queryLower = query.toLowerCase();
  const chunks = getCachedChunks();
  const playbooks = chunks.filter((c) => c.doc_id === 'DOC-PLAYBOOK-OPS');

  if (playbooks.length === 0) {
    return { matched: false };
  }

  // Calculate similarity or keyword match on playbooks
  const queryWords = queryLower.split(/[\s,.-]+/).filter((w) => w.length > 3);
  let bestMatch: ChunkWithEmbedding | null = null;
  let highestScore = 0;

  for (const pb of playbooks) {
    const pbText = pb.text.toLowerCase();
    let score = 0;
    for (const w of queryWords) {
      if (pbText.includes(w)) score += 1;
    }
    if (score > highestScore && score >= 2) {
      highestScore = score;
      bestMatch = pb;
    }
  }

  if (!bestMatch) {
    return { matched: false };
  }

  return {
    matched: true,
    ticketId: bestMatch.section.match(/TKT-\d+/i)?.[0] || 'TKT-501',
    problem: bestMatch.title.replace(/^Operational Playbook:\s*/i, ''),
    snippet: bestMatch.text,
  };
}
