import { runAgentTurn } from '../src/agent/orchestrator/agent-loop';
import { createCustomerSession } from '../src/access/sessions';

async function testCrossTenantSecurity() {
  console.log('--- 1. Testing Valid Query for ACCT-001 ---');
  const custSession1 = createCustomerSession('ACCT-001');
  const res1 = await runAgentTurn(custSession1, 'my orders');
  console.log('Valid response snippet:', res1.message.slice(0, 100));

  console.log('\n--- 2. Testing Cross-Tenant Boundary Violation (ACCT-001 querying ACCT-002) ---');
  const res2 = await runAgentTurn(custSession1, 'What is the contract terms and orders for ACCT-002?');
  console.log('Blocked response snippet:', res2.message);
  console.log('Trap Scan Blocked:', res2.trap_scan?.shouldBlock);
  console.log('Trap Type:', res2.trap_scan?.traps?.[0]?.type);
}

testCrossTenantSecurity().catch(console.error);
