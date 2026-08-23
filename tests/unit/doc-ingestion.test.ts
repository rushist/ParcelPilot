import { ingestDocuments } from '../../scripts/ingest-documents';
import { validateDocuments } from '../../scripts/validate-documents';
import { searchDocuments } from '../../src/retrieval/search';

async function testDocIngestion() {
  console.log('=== Testing Module 3: Document Ingestion & Retrieval ===\n');

  // 1. Run Ingestion
  console.log('1. Ingesting documents...');
  await ingestDocuments();

  // 2. Run Validation
  console.log('\n2. Validating ingested documents...');
  const report = validateDocuments();
  if (!report.isValid) {
    throw new Error(`Document validation failed: ${report.errors.join(', ')}`);
  }
  console.log(`✔ All ${report.docCount} documents and ${report.chunkCount} section chunks verified.`);

  // 3. Test Retrieval Gates
  console.log('\n3. Testing Mandatory Retrieval Scenarios:');

  // Gate A: Northstar cancellation (ACCT-001)
  console.log('\n- Test Scenario A: "Northstar cancellation" (for ACCT-001)');
  const nsResults = await searchDocuments('cancel shipment before pickup cancellation fee', {
    accountId: 'ACCT-001',
  });
  const topNs = nsResults[0];
  console.log(`  Top Result: [${topNs.doc_id}] ${topNs.section}`);
  console.log(`  Authority Rank: ${topNs.authority_rank}`);
  if (topNs.doc_id !== 'DOC-AGREEMENT-NORTHSTAR' || !topNs.text.includes('no cancellation fee')) {
    throw new Error(`Scenario A failed: Expected Northstar agreement zero-fee cancellation, got ${topNs.doc_id}`);
  }
  console.log('  ✔ Correctly retrieved Northstar zero-fee cancellation term over default SOP.');

  // Gate B: LumenWorks credit (ACCT-002)
  console.log('\n- Test Scenario B: "LumenWorks service credit" (for ACCT-002)');
  const lwResults = await searchDocuments('failed pickup service credit delay hours', {
    accountId: 'ACCT-002',
  });
  const topLw = lwResults[0];
  console.log(`  Top Result: [${topLw.doc_id}] ${topLw.section}`);
  if (topLw.doc_id !== 'DOC-AGREEMENT-LUMENWORKS' || !topLw.text.includes('300')) {
    throw new Error(`Scenario B failed: Expected LumenWorks INR 300 custom credit, got ${topLw.doc_id}`);
  }
  console.log('  ✔ Correctly retrieved LumenWorks custom INR 300 / 4-hour credit term.');

  // Gate C: Bulk upload limit
  console.log('\n- Test Scenario C: "bulk upload limit"');
  const bulkResults = await searchDocuments('bulk upload maximum CSV rows limit');
  const bulkChunk = bulkResults.find((r) => r.text.includes('5,000'));
  if (!bulkChunk) {
    throw new Error(`Scenario C failed: Expected 5,000 row product limit chunk`);
  }
  console.log(`  Top Result: [${bulkChunk.doc_id}] ${bulkChunk.section}`);
  console.log('  ✔ Correctly retrieved 5,000-row supported bulk upload limit.');

  // Gate D: KI-211 SwiftShip delay
  console.log('\n- Test Scenario D: "KI-211 SwiftShip pickup webhook delay"');
  const ki211Results = await searchDocuments('SwiftShip pickup webhook delay 20 minutes');
  const ki211Chunk = ki211Results.find((r) => r.text.includes('KI-211') || r.text.includes('20 minutes'));
  if (!ki211Chunk) {
    throw new Error(`Scenario D failed: Expected KI-211 SwiftShip delay advisory`);
  }
  console.log(`  Top Result: [${ki211Chunk.doc_id}] ${ki211Chunk.section}`);
  console.log('  ✔ Correctly retrieved KI-211 SwiftShip status lag advisory.');

  // Gate E: P1 definition
  console.log('\n- Test Scenario E: "P1 definition"');
  const p1Results = await searchDocuments('P1 critical severity credential exposure');
  const p1Chunk = p1Results.find((r) => r.text.includes('P1') && r.text.includes('credential exposure'));
  if (!p1Chunk || p1Chunk.doc_status === 'DEPRECATED') {
    throw new Error(`Scenario E failed: Expected Current Policy v3 P1 definition`);
  }
  console.log(`  Top Result: [${p1Chunk.doc_id}] ${p1Chunk.section}`);
  console.log('  ✔ Correctly retrieved Current Policy v3 P1 definition (including credential leaks).');

  // Deprecated Exclusion Check
  console.log('\n- Test Scenario F: Deprecated Policy v2 Exclusion');
  const generalResults = await searchDocuments('Enterprise P1 response target');
  const hasDeprecated = generalResults.some((r) => r.doc_status === 'DEPRECATED');
  if (hasDeprecated) {
    throw new Error('Scenario F failed: Deprecated document v2 was incorrectly returned in current answer context');
  }
  console.log('  ✔ Verified Deprecated Policy v2 is strictly filtered out from current search results.');

  console.log('\n=== Module 3 Document Ingestion & Retrieval Tests Completed Successfully ===');
}

testDocIngestion().catch((err) => {
  console.error('Doc Ingestion Test Failed:', err);
  process.exit(1);
});
