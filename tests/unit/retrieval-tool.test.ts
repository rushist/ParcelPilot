import { createCustomerSession, createInternalSession } from '../../src/access/sessions';
import { executeSearchDocs } from '../../src/agent/tools/search-tool';

async function testRetrievalTool() {
  console.log('=== Testing Module 7: Document Retrieval Tool (search_docs) ===\n');

  const customerNorthstar = createCustomerSession('ACCT-001');
  const customerLumenWorks = createCustomerSession('ACCT-002');
  const internalSupport = createInternalSession('support', 'Support1');

  // 1. "Northstar cancellation"
  console.log('1. Testing query: "Northstar cancellation" (for ACCT-001)...');
  const nsRes = await executeSearchDocs(customerNorthstar, {
    query: 'Northstar shipment cancellation fee terms before pickup',
  });
  const topNs = nsRes.result[0];
  console.log(`  Top match: [${topNs.doc_id}] ${topNs.section}`);
  console.log(`  Authority Rank: ${topNs.authority_rank}, Status: ${topNs.doc_status}`);
  if (topNs.doc_id !== 'DOC-AGREEMENT-NORTHSTAR' || !topNs.text.includes('no cancellation fee')) {
    throw new Error(`Failed to retrieve Northstar Agreement Section 2 as top source: ${JSON.stringify(topNs)}`);
  }
  console.log('  ✔ Correctly retrieved Northstar Enterprise Agreement Section 2.');

  // 2. "LumenWorks service credit"
  console.log('\n2. Testing query: "LumenWorks service credit" (for ACCT-002)...');
  const lwRes = await executeSearchDocs(customerLumenWorks, {
    query: 'failed pickup service credit delay terms',
  });
  const topLw = lwRes.result[0];
  console.log(`  Top match: [${topLw.doc_id}] ${topLw.section}`);
  if (topLw.doc_id !== 'DOC-AGREEMENT-LUMENWORKS' || !topLw.text.includes('300')) {
    throw new Error(`Failed to retrieve LumenWorks Agreement Section 3: ${JSON.stringify(topLw)}`);
  }
  console.log('  ✔ Correctly retrieved LumenWorks Service Agreement Section 3 (fixed INR 300 / 4-hour delay).');

  // 3. "bulk upload limit"
  console.log('\n3. Testing query: "bulk upload limit"...');
  const bulkRes = await executeSearchDocs(internalSupport, {
    query: 'bulk upload maximum supported CSV rows limit for Growth and Enterprise',
  });
  const bulkChunk = bulkRes.result.find((r) => r.text.includes('5,000'));
  if (!bulkChunk) {
    throw new Error('Failed to retrieve 5,000-row supported bulk upload limit');
  }
  console.log(`  Top match: [${bulkChunk.doc_id}] ${bulkChunk.section}`);
  console.log('  ✔ Correctly retrieved Product Operations Guide Section 1 (5,000 rows max limit).');

  // 4. "BOOKED after pickup" (KI-211 webhook lag)
  console.log('\n4. Testing query: "BOOKED after pickup"...');
  const ki211Res = await executeSearchDocs(customerNorthstar, {
    query: 'shipment status shows BOOKED after actual pickup occurred carrier webhook delay',
  });
  const ki211Chunk = ki211Res.result.find((r) => r.text.includes('KI-211') || r.text.includes('20 minutes'));
  if (!ki211Chunk) {
    throw new Error('Failed to retrieve KI-211 SwiftShip delay advisory');
  }
  console.log(`  Match: [${ki211Chunk.doc_id}] ${ki211Chunk.section}`);
  console.log('  ✔ Correctly retrieved KI-211 SwiftShip status webhook lag advisory.');

  // 5. "P1 credential exposure"
  console.log('\n5. Testing query: "P1 credential exposure"...');
  const p1Res = await executeSearchDocs(internalSupport, {
    query: 'P1 critical incident definition credential exposure API key leak',
  });
  const p1Chunk = p1Res.result.find((r) => r.text.includes('P1') && r.text.includes('credential exposure'));
  if (!p1Chunk || p1Chunk.doc_status === 'DEPRECATED') {
    throw new Error('Failed to retrieve Policy v3 P1 definition');
  }
  console.log(`  Top match: [${p1Chunk.doc_id}] ${p1Chunk.section}`);
  console.log('  ✔ Correctly retrieved Support Policy v3 Section 2.');

  // 6. Cross-Tenant Agreement Leakage Test
  console.log('\n6. Testing Cross-Tenant Agreement Isolation:');
  const crossLeakRes = await executeSearchDocs(customerNorthstar, {
    query: 'LumenWorks agreement failed pickup credit',
  });
  const hasLumenWorksAgreement = crossLeakRes.result.some((r) => r.doc_id === 'DOC-AGREEMENT-LUMENWORKS');
  if (hasLumenWorksAgreement) {
    throw new Error('Security Breach: Customer ACCT-001 retrieved ACCT-002 LumenWorks agreement.');
  }
  console.log('  ✔ Customer ACCT-001 strictly prohibited from retrieving ACCT-002 agreement.');

  // 7. Deprecated Policy v2 Filtering
  console.log('\n7. Testing Deprecated Document Handling:');
  const currentOnlyRes = await executeSearchDocs(internalSupport, {
    query: 'Enterprise P1 first response target time',
  });
  const hasDeprecated = currentOnlyRes.result.some((r) => r.doc_status === 'DEPRECATED');
  if (hasDeprecated) {
    throw new Error('Deprecated document v2 was incorrectly returned in standard search');
  }
  console.log('  ✔ Deprecated Policy v2 excluded from current response context.');

  const historicalRes = await executeSearchDocs(internalSupport, {
    query: 'What was the old deprecated response target in policy v2?',
    include_deprecated: true,
  });
  const hasDeprecatedExplicit = historicalRes.result.some((r) => r.doc_status === 'DEPRECATED');
  if (!hasDeprecatedExplicit) {
    throw new Error('Explicit historical query with include_deprecated: true failed to retrieve v2');
  }
  console.log('  ✔ Deprecated Policy v2 retrieved when explicitly requested with include_deprecated: true.');

  console.log('\n=== Module 7 Document Retrieval Tool Tests Completed Successfully ===');
}

testRetrievalTool().catch((err) => {
  console.error('Retrieval tool test failed:', err);
  process.exit(1);
});
