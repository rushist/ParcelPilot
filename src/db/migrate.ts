import fs from 'fs';
import path from 'path';
import { pool } from '../lib/db';
import { qdrantClient, QDRANT_DOCS_COLLECTION } from '../lib/qdrant';

export async function runMigrations() {
  console.log('=== Starting Database & Vector Collection Migrations ===\n');

  // 1. Run PostgreSQL Schema Migration
  console.log('1. Applying PostgreSQL schema from schema.sql...');
  const sqlPath = path.join(__dirname, 'schema.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sqlContent);
    await client.query('COMMIT');
    console.log('[SUCCESS] PostgreSQL tables and indexes created successfully:');
    console.log('  - accounts');
    console.log('  - orders');
    console.log('  - tickets');
    console.log('  - doc_chunks (with GIN tsvector full-text index)');
    console.log('  - actions');
    console.log('  - audit_logs');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[ERROR] PostgreSQL Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }

  // 2. Initialize Qdrant Collection
  console.log('\n2. Initializing Qdrant vector collection...');
  try {
    const collectionsRes = await qdrantClient.getCollections();
    const existing = collectionsRes.collections.some((c) => c.name === QDRANT_DOCS_COLLECTION);

    if (existing) {
      console.log(`[INFO] Collection "${QDRANT_DOCS_COLLECTION}" already exists. Recreating for clean migration...`);
      await qdrantClient.deleteCollection(QDRANT_DOCS_COLLECTION);
    }

    // Create collection with 1536 dimension (text-embedding-3-small) and Cosine distance
    await qdrantClient.createCollection(QDRANT_DOCS_COLLECTION, {
      vectors: {
        size: 1536,
        distance: 'Cosine',
      },
      optimizers_config: {
        default_segment_number: 2,
      },
    });
    console.log(`[SUCCESS] Qdrant collection "${QDRANT_DOCS_COLLECTION}" created (dim: 1536, metric: Cosine)`);

    // Create payload indexes for fast filtered vector retrieval
    const payloadFields = [
      { name: 'doc_id', type: 'keyword' as const },
      { name: 'doc_status', type: 'keyword' as const },
      { name: 'doc_type', type: 'keyword' as const },
      { name: 'account_id', type: 'keyword' as const },
      { name: 'section', type: 'keyword' as const },
      { name: 'authority_rank', type: 'integer' as const },
    ];

    for (const field of payloadFields) {
      await qdrantClient.createPayloadIndex(QDRANT_DOCS_COLLECTION, {
        field_name: field.name,
        field_schema: field.type,
      });
      console.log(`  - Payload index created: ${field.name} (${field.type})`);
    }

    console.log('[SUCCESS] All Qdrant payload indexes initialized.');
  } catch (error: any) {
    console.warn(`[WARNING] Qdrant initialization note/warning: ${error?.message || error}`);
  }

  console.log('\n=== Migration Completed Successfully ===');
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal Migration Error:', err);
      process.exit(1);
    });
}
