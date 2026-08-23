import { runAgentTurn } from '../src/agent/orchestrator/agent-loop';
import { createCustomerSession } from '../src/access/sessions';

async function test() {
  console.log('Testing "my orders" query on ACCT-011...');
  const session = createCustomerSession('ACCT-011');
  const response = await runAgentTurn(session, 'my orders');

  console.log('\n--- AGENT RESPONSE ---');
  console.log(response.message);

  console.log('\n--- TOOLS EXECUTED ---');
  console.log(response.tool_traces.map((t) => t.tool));
}

test().catch(console.error);
