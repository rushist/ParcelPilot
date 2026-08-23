import { runAgentTurn } from '../src/agent/orchestrator/agent-loop';
import { createInternalSession } from '../src/access/sessions';
import { learnOpsResolution } from '../src/retrieval/operational-memory';
import { getAccountChatMessages } from '../src/lib/chat-store';

async function testRolePlaybookAndEscalation() {
  console.log('--- 1. Learning Playbook requiring Manager Authorization ---');
  await learnOpsResolution({
    ticketId: 'TKT-501',
    accountId: 'ACCT-001',
    problem: 'Carrier dispatch fee dispute for Northstar high volume shipments',
    resolution: 'Special waiver requires Manager approval to override policy and issue concession token.',
    operator: 'STAFF (OPS)',
  });
  console.log('Learned playbook requiring Manager approval indexed.');

  console.log('\n--- 2. Querying similar incident as Support ---');
  const supportSession = createInternalSession('support', 'Agent_Maya', 'ACCT-001');
  const res1 = await runAgentTurn(supportSession, 'How do we handle carrier dispatch fee dispute for Northstar?');
  console.log(res1.message);
  console.log('Proposal Target Role:', res1.proposed_action?.payload?.target_role || (res1.proposed_action?.requires_manager_approval ? 'manager' : 'support'));
  console.log('Requires Manager Approval:', res1.proposed_action?.requires_manager_approval);

  console.log('\n--- 3. Escalating from Ops to Manager ---');
  const opsSession = createInternalSession('ops', 'Agent_Vikram', 'ACCT-001');
  const res2 = await runAgentTurn(opsSession, '/escalate manager High priority outage on SwiftShip webhook');
  console.log(res2.message);

  console.log('\n--- 4. Checking Role-Isolated Chat Queues ---');
  const allMessages = getAccountChatMessages('ACCT-001', 'support');
  const managerMessages = getAccountChatMessages('ACCT-001', 'manager');
  const opsMessages = getAccountChatMessages('ACCT-001', 'ops');

  console.log(`Support Queue Count: ${allMessages.length}`);
  console.log(`Ops Queue Count: ${opsMessages.length}`);
  console.log(`Manager Queue Count: ${managerMessages.length}`);
}

testRolePlaybookAndEscalation().catch(console.error);
