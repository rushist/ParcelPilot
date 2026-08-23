import { createCustomerSession, createInternalSession } from '../../src/access/sessions';
import { getSystemPrompt } from '../../src/agent/prompts/system-prompt';
import { getAvailableToolsForSession } from '../../src/agent/orchestrator/tool-dispatcher';
import { runAgentTurn } from '../../src/agent/orchestrator/agent-loop';

async function testOrchestrator() {
  console.log('=== Testing Module 10: Agent Orchestrator & Tool Loop ===\n');

  const customerSession = createCustomerSession('ACCT-001'); // Northstar
  const internalSession = createInternalSession('support', 'Maya');

  // 1. Test System Prompts
  console.log('1. Testing System Prompts:');
  const custPrompt = await getSystemPrompt(customerSession);
  if (!custPrompt.includes('ACCT-001') || !custPrompt.includes('Northstar Logistics')) {
    throw new Error('Customer prompt missing account context');
  }
  console.log('  [PASS] Customer system prompt generated with ACCT-001 account boundary.');

  const intPrompt = await getSystemPrompt(internalSession);
  if (!intPrompt.includes('Maya') || !intPrompt.includes('support')) {
    throw new Error('Internal prompt missing role context');
  }
  console.log('  [PASS] Internal system prompt generated with staff role boundary.');

  // 2. Test Available Tools per Surface
  console.log('\n2. Testing Available Tools Filtering:');
  const custTools = getAvailableToolsForSession(customerSession);
  const hasInsightsCustomer = custTools.some((t) => t.name === 'get_insights');
  if (hasInsightsCustomer) {
    throw new Error('Security Breach: get_insights tool was exposed to customer surface!');
  }
  console.log(`  [PASS] Customer surface has ${custTools.length} tools (get_insights strictly excluded).`);

  const intTools = getAvailableToolsForSession(internalSession);
  const hasInsightsInternal = intTools.some((t) => t.name === 'get_insights');
  if (!hasInsightsInternal) {
    throw new Error('Internal surface missing get_insights tool');
  }
  console.log(`  [PASS] Internal surface has ${intTools.length} tools (includes get_insights).`);

  // 3. Multi-Step Execution: Northstar Cancellation
  console.log('\n3. Testing Multi-Step Tool Turn: Northstar Cancellation (ORD-1001)...');
  const turn1 = await runAgentTurn(customerSession, 'Can I cancel ORD-1001 and what is the cancellation fee?');

  console.log(`  Response Text:\n  "${turn1.message}"\n`);
  console.log(`  Tool Calls Executed (${turn1.tool_traces.length}):`);
  for (const trace of turn1.tool_traces) {
    console.log(`  - [${trace.tool}] Duration: ${trace.durationMs}ms, Success: ${trace.success}`);
  }
  console.log(`  Sources Cited (${turn1.sources.length}):`);
  for (const s of turn1.sources) {
    console.log(`  - [${s.doc_id}] ${s.section} (Rank: ${s.authority_rank})`);
  }

  const calledCalc = turn1.tool_traces.some((t) => t.tool === 'calc_cancellation_fee');
  const hasNorthstarSource = turn1.sources.some((s) => s.doc_id === 'DOC-AGREEMENT-NORTHSTAR');
  if (!calledCalc || !hasNorthstarSource) {
    throw new Error('Turn failed to invoke calc_cancellation_fee or cite Northstar Agreement');
  }
  console.log('  [PASS] Verified deterministic calculator called and Northstar Agreement cited.');

  // 4. Action Proposal Execution
  console.log('\n4. Testing Action Proposal Turn...');
  const turn2 = await runAgentTurn(customerSession, 'Please cancel ORD-1001 for me now');
  if (!turn2.proposed_action || turn2.proposed_action.type !== 'cancellation') {
    throw new Error('Turn failed to return proposed_action object for confirmation card');
  }
  console.log(`  [PASS] Returned action draft: ${turn2.proposed_action.action_id} (Fee: ₹${turn2.proposed_action.payload.fee_inr})`);

  // 5. Bulk Upload and Known Issues
  console.log('\n5. Testing Bulk Upload & KI-208 Knowledge Turn...');
  const turn3 = await runAgentTurn(internalSession, 'What is the bulk upload CSV limit? Are there any known issues?');
  if (!turn3.message.includes('5,000') || !turn3.message.includes('3,000') || !turn3.message.includes('KI-208')) {
    throw new Error('Turn failed to mention 5,000 limit, 3,000 threshold, or KI-208');
  }
  console.log('  [PASS] Correctly synthesized 5,000-row product limit and KI-208 workaround.');

  console.log('\n=== Module 10 Agent Orchestrator Tests Completed Successfully ===');
}

testOrchestrator().catch((err) => {
  console.error('Orchestrator test failed:', err);
  process.exit(1);
});
