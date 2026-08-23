import { createInternalSession } from '../../src/access/sessions';
import { runAgentTurn } from '../../src/agent/orchestrator/agent-loop';
import { executeProposeAction, executeConfirmAction } from '../../src/agent/tools/action-tools';

async function testInternalUI() {
  console.log('=== Testing Module 12: Internal Chatbot Interface & Capabilities ===\n');

  const supportSession = createInternalSession('support', 'Maya');
  const managerSession = createInternalSession('manager', 'Priya');

  // 1. Cross-Account Query (Allowed for Internal)
  console.log('1. Testing Cross-Account Lookup for Northstar and LumenWorks...');
  const turn1 = await runAgentTurn(supportSession, 'Check status and cancellation fee for ORD-1001 (Northstar) and ORD-2001 (LumenWorks)');
  console.log(`  Response: "${turn1.message.slice(0, 150)}..."`);
  const calledOrders = turn1.tool_traces.some((t) => t.tool === 'get_orders' && t.success);
  if (!calledOrders) {
    throw new Error('Internal turn failed to execute cross-account get_orders query');
  }
  console.log('  [PASS] Cross-account inspection permitted for authorized internal role.');

  // 2. Proactive Insights Query via Internal Chat
  console.log('\n2. Testing Proactive Insights via Internal Agent...');
  const turn2 = await runAgentTurn(supportSession, 'What are the current topic spikes and security triage incidents?');
  console.log(`  Response: "${turn2.message.slice(0, 180)}..."`);
  const calledInsights = turn2.tool_traces.some((t) => t.tool === 'get_insights' && t.success);
  if (!calledInsights) {
    throw new Error('Internal turn failed to invoke get_insights tool');
  }
  console.log('  [PASS] Proactive insights tool executed and synthesized.');

  // 3. Security Triage and Escalation
  console.log('\n3. Testing Security Triage & Action Proposal...');
  const turn3 = await runAgentTurn(supportSession, 'Please propose an escalation for ticket TKT-505 (Axis Labs API key exposure)');
  if (!turn3.proposed_action || turn3.proposed_action.type !== 'escalation') {
    throw new Error('Internal turn failed to generate escalation action proposal');
  }
  console.log(`  [PASS] Escalation proposal generated: ${turn3.proposed_action.action_id} (${turn3.proposed_action.title})`);

  // 4. High-Value Credit Role Authorization Barrier
  console.log('\n4. Testing Role Authorization: High-Value Credit Proposal & Approval...');
  const propCredit = await executeProposeAction(supportSession, {
    type: 'service_credit',
    target_id: 'ORD-1001',
    reason: 'Executive concession for delayed pickup',
    details: { amount_inr: 2500, override_manager_reason: 'Executive account manager concession' },
  });

  if (!propCredit.result.requires_manager_approval) {
    throw new Error('Credit of INR 2500 failed to trigger manager approval flag');
  }
  console.log('  [PASS] Credit > INR 1,000 flagged for Manager Approval.');

  // Support attempts confirmation (Must fail)
  try {
    await executeConfirmAction(supportSession, { action_id: propCredit.result.action_id });
    throw new Error('Security Breach: Support role confirmed high-value credit.');
  } catch (err: any) {
    console.log('  [PASS] Support role blocked from confirming credit > INR 1,000.');
  }

  // Manager confirms (Must succeed)
  const confManager = await executeConfirmAction(managerSession, { action_id: propCredit.result.action_id });
  if (confManager.result.status !== 'CONFIRMED') {
    throw new Error('Manager confirmation failed');
  }
  console.log(`  [PASS] Manager confirmed credit: ${confManager.result.message}`);

  console.log('\n=== Module 12 Internal Chatbot Interface Tests Completed Successfully ===');
}

testInternalUI().catch((err) => {
  console.error('Internal UI test failed:', err);
  process.exit(1);
});
