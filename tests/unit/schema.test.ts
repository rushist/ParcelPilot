import fs from 'fs';
import path from 'path';
import { runMigrations } from '../../src/db/migrate';
import { checkDbConnection } from '../../src/lib/db';

async function testSchema() {
  console.log('=== Testing Module 1: Database Schema & Vector Collection ===\n');

  // 1. Check SQL schema file existence and completeness
  const sqlPath = path.join(__dirname, '../../src/db/schema.sql');
  if (!fs.existsSync(sqlPath)) {
    throw new Error('schema.sql does not exist');
  }
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const requiredTables = ['accounts', 'orders', 'tickets', 'doc_chunks', 'actions', 'audit_logs'];
  console.log('1. Checking SQL schema table definitions:');
  for (const table of requiredTables) {
    const tableDef = `CREATE TABLE ${table}`;
    if (sql.includes(tableDef)) {
      console.log(`  [PASS] Table "${table}" defined in schema.sql`);
    } else {
      throw new Error(`Table "${table}" missing from schema.sql`);
    }
  }

  // 2. Check full-text search and index definitions
  console.log('\n2. Checking indexes and full-text search triggers:');
  const requiredIndexes = [
    'idx_accounts_status',
    'idx_orders_account_id',
    'idx_tickets_account_id',
    'idx_doc_chunks_tsv',
    'idx_actions_account_id',
    'idx_audit_logs_account_id',
  ];
  for (const idx of requiredIndexes) {
    if (sql.includes(idx)) {
      console.log(`  [PASS] Index "${idx}" defined`);
    } else {
      throw new Error(`Index "${idx}" missing from schema.sql`);
    }
  }

  if (sql.includes('trg_doc_chunks_tsv')) {
    console.log('  [PASS] GIN tsvector trigger "trg_doc_chunks_tsv" defined');
  } else {
    throw new Error('Full-text search trigger missing');
  }

  // 3. Test running migration if live database is reachable
  console.log('\n3. Testing live database migration if connection available...');
  const dbHealth = await checkDbConnection();
  if (dbHealth.ok) {
    console.log('Database connected, running full migration...');
    await runMigrations();
    console.log('[PASS] Live database migration succeeded');
  } else {
    console.log(`[INFO] Live DB offline (${dbHealth.error}). Schema definitions verified via static parsing.`);
  }

  console.log('\n=== Module 1 Schema Test Completed Successfully ===');
}

testSchema().catch((err) => {
  console.error('Schema test failed:', err);
  process.exit(1);
});
