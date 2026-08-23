import { runAgentTurn } from '../src/agent/orchestrator/agent-loop';
import { createCustomerSession } from '../src/access/sessions';

async function testCancellationFlow() {
  const session = createCustomerSession('ACCT-001');

  console.log('--- 1. Testing "cancel order ORD-1003" ---');
  const res1 = await runAgentTurn(session, 'cancel order ORD-1003');
  console.log(res1.message);
  console.log('Proposed Action Type:', res1.proposed_action?.type, '| Target:', res1.proposed_action?.payload?.target_id);

  console.log('\n--- 2. Testing follow-up "yes" response with conversation history ---');
  const history = [
    { role: 'user' as const, content: 'cancel order ORD-1003' },
    { role: 'assistant' as const, content: 'Would you like me to propose the cancellation for this shipment?' },
  ];
  const res2 = await runAgentTurn(session, 'yes', history);
  console.log(res2.message);
  console.log('Proposed Action Type:', res2.proposed_action?.type, '| Target:', res2.proposed_action?.payload?.target_id);
}

testCancellationFlow().catch(console.error);
