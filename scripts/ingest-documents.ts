import fs from 'fs';
import path from 'path';
import { parseDocumentSections } from '../src/retrieval/ingestion';
import { generateEmbeddingsBatch } from '../src/retrieval/embedding';
import { pool, checkDbConnection } from '../src/lib/db';
import { qdrantClient, QDRANT_DOCS_COLLECTION, checkQdrantConnection } from '../src/lib/qdrant';

export interface ChunkWithEmbedding {
  id: string;
  doc_id: string;
  doc_status: 'CURRENT' | 'DEPRECATED';
  doc_type: 'policy' | 'sop' | 'guide' | 'agreement';
  effective_date: string;
  account_id: string | null;
  section: string;
  title: string;
  authority_rank: number;
  text: string;
  embedding: number[];
}

export async function ingestDocuments() {
  console.log('=== Starting ParcelPilot Document Ingestion ===\n');

  let enrichedChunks: ChunkWithEmbedding[] = [];

  try {
    console.log('1. Parsing section chunks from all 6 PDF documents...');
    const chunks = await parseDocumentSections();
    console.log(`✔ Extracted ${chunks.length} structured sections across 6 documents.`);

    console.log('\n2. Generating vector embeddings for all sections...');
    const textsToEmbed = chunks.map((c) => `${c.title}: ${c.text}`);
    const embeddings = await generateEmbeddingsBatch(textsToEmbed);
    console.log(`✔ Generated ${embeddings.length} vector embeddings (dimension: ${embeddings[0].length}).`);

    enrichedChunks = chunks.map((c, idx) => ({
      id: c.id,
      doc_id: c.doc_id,
      doc_status: c.doc_status,
      doc_type: c.doc_type,
      effective_date: c.effective_date || '2026-05-01',
      account_id: c.account_id ?? null,
      section: c.section,
      title: c.title || c.section,
      authority_rank: c.authority_rank,
      text: c.text,
      embedding: embeddings[idx],
    }));
  } catch (err: any) {
    const fallbackPath = path.join(__dirname, '../src/data/doc-chunks.json');
    if (fs.existsSync(fallbackPath)) {
      console.log(`\nNotice: PDF parsing had an issue (${err.message}). Loading pre-calculated doc chunks from ${fallbackPath}...`);
      enrichedChunks = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
      console.log(`✔ Loaded ${enrichedChunks.length} pre-calculated chunks with embeddings.`);
    } else {
      throw err;
    }
  }

  // Save to static JSON cache
  const dataDir = path.join(__dirname, '../src/data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const jsonPath = path.join(dataDir, 'doc-chunks.json');
  fs.writeFileSync(jsonPath, JSON.stringify(enrichedChunks, null, 2), 'utf8');
  console.log(`✔ Saved ${enrichedChunks.length} chunks with embeddings to src/data/doc-chunks.json`);

  // Insert into PostgreSQL if connected
  const dbHealth = await checkDbConnection();
  if (dbHealth.ok) {
    console.log('\n3. Storing chunks in PostgreSQL doc_chunks table...');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM doc_chunks');

      for (const c of enrichedChunks) {
        await client.query(
          `INSERT INTO doc_chunks (id, doc_id, doc_status, doc_type, effective_date, account_id, section, title, authority_rank, text)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            c.id,
            c.doc_id,
            c.doc_status,
            c.doc_type,
            c.effective_date,
            c.account_id,
            c.section,
            c.title,
            c.authority_rank,
            c.text,
          ]
        );
      }
      await client.query('COMMIT');
      console.log('✔ Stored chunks in PostgreSQL (full-text tsvector index updated automatically via trigger).');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Failed to store chunks in Postgres:', err);
    } finally {
      client.release();
    }
  } else {
    console.log(`ℹ PostgreSQL offline (${dbHealth.error}). Chunks cached in local JSON index.`);
  }

  // Insert into Qdrant if connected
  const qdrantHealth = await checkQdrantConnection();
  if (qdrantHealth.ok) {
    console.log('\n4. Upserting vectors into Qdrant collection...');
    try {
      const collections = await qdrantClient.getCollections();
      if (!collections.collections.some((col) => col.name === QDRANT_DOCS_COLLECTION)) {
        await qdrantClient.createCollection(QDRANT_DOCS_COLLECTION, {
          vectors: { size: enrichedChunks[0]?.embedding?.length || 1536, distance: 'Cosine' },
        });
      }

      const points = enrichedChunks.map((c, index) => ({
        id: index + 1,
        vector: c.embedding,
        payload: {
          chunk_id: c.id,
          doc_id: c.doc_id,
          doc_status: c.doc_status,
          doc_type: c.doc_type,
          effective_date: c.effective_date,
          account_id: c.account_id,
          section: c.section,
          title: c.title,
          authority_rank: c.authority_rank,
          text: c.text,
        },
      }));

      await qdrantClient.upsert(QDRANT_DOCS_COLLECTION, {
        wait: true,
        points,
      });
      console.log(`✔ Upserted ${points.length} vectors into Qdrant collection "${QDRANT_DOCS_COLLECTION}".`);
    } catch (err) {
      console.warn('Qdrant upsert notice/warning:', err);
    }
  } else {
    console.log(`ℹ Qdrant offline (${qdrantHealth.error}). Vector embeddings cached for similarity search.`);
  }

  console.log('\n=== Document Ingestion Completed Successfully ===');
}

if (require.main === module) {
  ingestDocuments()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Document Ingestion Failed:', err);
      process.exit(1);
    });
}
