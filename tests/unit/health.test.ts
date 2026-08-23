import { checkDbConnection } from '../../src/lib/db';
import { checkQdrantConnection } from '../../src/lib/qdrant';
import { validateConfig } from '../../src/lib/config';

async function runHealthTest() {
  console.log('=== Running Module 0 Health & Connectivity Tests ===\n');

  console.log('1. Checking configuration validation...');
  const cfg = validateConfig();
  console.log(`- Config valid: ${cfg.isValid}`);
  if (!cfg.isValid) {
    console.warn(`- Missing environment variables: ${cfg.missing.join(', ')}`);
  }

  console.log('\n2. Checking PostgreSQL database connection...');
  const dbRes = await checkDbConnection();
  if (dbRes.ok) {
    console.log(`- PostgreSQL connected successfully (latency: ${dbRes.latencyMs}ms)`);
  } else {
    console.log(`- PostgreSQL connection failed: ${dbRes.error}`);
  }

  console.log('\n3. Checking Qdrant vector database connection...');
  const qdrantRes = await checkQdrantConnection();
  if (qdrantRes.ok) {
    console.log(`- Qdrant connected successfully (latency: ${qdrantRes.latencyMs}ms)`);
  } else {
    console.log(`- Qdrant connection failed: ${qdrantRes.error}`);
  }

  console.log('\n=== Health Test Completed ===');
}

runHealthTest().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
