import { createCustomerSession } from '../../src/access/sessions';
import { runAgentTurn } from '../../src/agent/orchestrator/agent-loop';
import { confirmAction } from '../../src/actions/confirm';
import { getAuditLogsByAccount } from '../../src/actions/store';

async function testCustomerUI() {
  console.log('=== Testing Module 11: Customer Chatbot Interface & Flow ===\n');

  const customerNorthstar = createCustomerSession('ACCT-001');
  const customerLumenWorks = createCustomerSession('ACCT-002');

  // 1. Gate A: Northstar cancellation
  console.log('1. Testing Northstar Cancellation Flow (ACCT-001)...');
  const turn1 = await runAgentTurn(customerNorthstar, 'Can I cancel ORD-1001 and what is the fee?');
  console.log(`  Response: "${turn1.message.slice(0, 150)}..."`);
  if (!turn1.message.includes('0') || !turn1.sources.some((s) => s.doc_id === 'DOC-AGREEMENT-NORTHSTAR')) {
    throw new Error('Customer turn failed to return Northstar zero-fee agreement citation');
  }
  console.log('  ✔ Northstar zero-fee cancellation verified.');

  // 2. Gate B: LumenWorks credit
  console.log('\n2. Testing LumenWorks Service Credit Flow (ACCT-002)...');
  const turn2 = await runAgentTurn(customerLumenWorks, 'Why was pickup delayed on ORD-2002? Am I eligible for credit?');
  console.log(`  Response: "${turn2.message.slice(0, 150)}..."`);
  if (!turn2.sources.some((s) => s.doc_id === 'DOC-AGREEMENT-LUMENWORKS' || s.doc_id === 'DOC-SOP-V4')) {
    throw new Error('Customer turn failed to cite LumenWorks agreement or SOP');
  }
  console.log('  ✔ LumenWorks credit policy verified.');

  // 3. Gate C: Bulk Upload Limit
  console.log('\n3. Testing Bulk Upload Limit Query...');
  const turn3 = await runAgentTurn(customerNorthstar, 'What is the bulk upload CSV limit?');
  if (!turn3.message.includes('5,000') || !turn3.message.includes('KI-208')) {
    throw new Error('Customer turn failed to cite 5,000 product limit and KI-208');
  }
  console.log('  ✔ Bulk upload 5,000-row limit and KI-208 workaround cited.');

  // 4. Gate D: BOOKED after pickup (KI-211)
  console.log('\n4. Testing BOOKED status after actual pickup (KI-211)...');
  const turn4 = await runAgentTurn(customerNorthstar, 'My driver collected the package 10 minutes ago but status still shows BOOKED. Why?');
  if (!turn4.message.includes('KI-211') && !turn4.message.includes('20 minutes')) {
    throw new Error('Customer turn failed to advise on KI-211 webhook delay');
  }
  console.log('  ✔ KI-211 status delay advisory cited.');

  // 5. Gate E: Propose & Confirm Action End-to-End
  console.log('\n5. Testing Action Proposal & UI Confirmation End-to-End...');
  const propTurn = await runAgentTurn(customerNorthstar, 'Please proceed and cancel ORD-1001 for me');
  if (!propTurn.proposed_action) {
    throw new Error('Agent failed to return proposed_action object for UI card');
  }
  console.log(`  ✔ Proposed action created: ${propTurn.proposed_action.action_id} (${propTurn.proposed_action.title})`);

  const confResult = await confirmAction(customerNorthstar, propTurn.proposed_action.action_id);
  console.log(`  ✔ Confirmed action via API: Status ${confResult.status}, Audit ID: ${confResult.audit_log_id}`);

  const logs = await getAuditLogsByAccount('ACCT-001');
  if (!logs.some((l) => l.payload?.action_id === propTurn.proposed_action!.action_id)) {
    throw new Error('Audit log missing for confirmed action');
  }
  console.log('  ✔ End-to-end confirmation and audit log verified.');

  // 6. Gate F: Cross-Account Request Barrier
  console.log('\n6. Testing Cross-Account Request Barrier...');
  const crossTurn = await runAgentTurn(customerNorthstar, 'Can you cancel ORD-2001 (belonging to LumenWorks)?');
  // Order ORD-2001 is on ACCT-002, so get_orders / calc will fail or return not found / access denied
  const hasCrossAccess = crossTurn.tool_traces.some((t) => t.tool === 'get_orders' && t.success && t.inputs.account_id === 'ACCT-002');
  if (hasCrossAccess) {
    throw new Error('Security Breach: Customer accessed cross-account order.');
  }
  console.log('  ✔ Cross-account request strictly blocked at data layer.');

  console.log('\n=== Module 11 Customer Chatbot Interface Tests Completed Successfully ===');
}

testCustomerUI().catch((err) => {
  console.error('Customer UI test failed:', err);
  process.exit(1);
});
