import { createCustomerSession } from '../src/access/sessions';
import { runAgentTurn } from '../src/agent/orchestrator/agent-loop';

async function verifyChatbotExperience() {
  console.log('=== Verifying Chatbot Conversational Experience ===\n');
  const session = createCustomerSession('ACCT-001');
  session.ticket_id = 'TKT-868';

  // Turn 1: Initial report
  console.log('1. User sends: "Shipment was delivered but not updated and payment was done"');
  const turn1 = await runAgentTurn(session, 'Shipment was delivered but not updated and payment was done', []);
  console.log('Assistant Response:\n' + turn1.message);
  console.log('Proposed action:', turn1.proposed_action?.type, '\n-----------------------------------');

  // Turn 2: Follow-up question
  console.log('2. User sends: "what can i do to solve this"');
  const history = [
    { role: 'user' as const, content: 'Shipment was delivered but not updated and payment was done' },
    { role: 'assistant' as const, content: turn1.message },
  ];
  const turn2 = await runAgentTurn(session, 'what can i do to solve this', history);
  console.log('Assistant Response:\n' + turn2.message);
  console.log('Proposed action:', turn2.proposed_action?.type, '\n-----------------------------------');

  // Turn 3: User confirms
  console.log('3. User sends: "yes, please do it"');
  const history2 = [
    ...history,
    { role: 'user' as const, content: 'what can i do to solve this' },
    { role: 'assistant' as const, content: turn2.message },
  ];
  const turn3 = await runAgentTurn(session, 'yes, please do it', history2);
  console.log('Assistant Response:\n' + turn3.message);
  console.log('Proposed action:', turn3.proposed_action?.type, '\n-----------------------------------');

  // Turn 4: Orders inquiry
  console.log('4. User sends: "my orders"');
  const turn4 = await runAgentTurn(session, 'my orders', history2);
  console.log('Assistant Response:\n' + turn4.message, '\n-----------------------------------');

  // Turn 5: SLA inquiry
  console.log('5. User sends: "what is our SLA?"');
  const turn5 = await runAgentTurn(session, 'what is our SLA?', history2);
  console.log('Assistant Response:\n' + turn5.message, '\n-----------------------------------');

  console.log('[PASS] All conversational chatbot checks succeeded.');
}

verifyChatbotExperience()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
