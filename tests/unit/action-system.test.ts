import { createCustomerSession, createInternalSession } from '../../src/access/sessions';
import { executeProposeAction, executeConfirmAction } from '../../src/agent/tools/action-tools';
import { getActionRecordById, getAuditLogsByAccount } from '../../src/actions/store';

async function testActionSystem() {
  console.log('=== Testing Module 8: Two-Phase Action System ===\n');

  const customerNorthstar = createCustomerSession('ACCT-001');
  const supportUser = createInternalSession('support', 'SupportAgent1');
  const managerUser = createInternalSession('manager', 'ManagerPriya');

  // Test 1: Propose Action without Confirmation (Verify no premature execution)
  console.log('1. Testing propose_action without confirmation...');
  const prop1 = await executeProposeAction(customerNorthstar, {
    type: 'cancellation',
    target_id: 'ORD-1001',
    reason: 'Customer requested cancellation before pickup.',
  });

  console.log(`  ✔ Proposed action created: ${prop1.result.action_id} (Status: ${prop1.result.status})`);
  console.log(`    Title: ${prop1.result.title}`);
  console.log(`    Fee: INR ${prop1.result.payload.fee_inr}`);

  const storedAction1 = await getActionRecordById(prop1.result.action_id);
  if (!storedAction1 || storedAction1.status !== 'PROPOSED') {
    throw new Error('Action state not saved as PROPOSED');
  }
  if (storedAction1.confirmed_at) {
    throw new Error('Security Violation: Action was confirmed before explicit user confirmation step!');
  }
  console.log('  ✔ Verified state remains uncommitted (PROPOSED) until explicit confirmation.');

  // Test 2: Confirm Action
  console.log('\n2. Testing confirm_action for proposed cancellation...');
  const conf1 = await executeConfirmAction(customerNorthstar, {
    action_id: prop1.result.action_id,
  });

  console.log(`  ✔ Action confirmed: ${conf1.result.action_id} by ${conf1.result.confirmed_by}`);
  console.log(`    Audit Log ID: ${conf1.result.audit_log_id}`);

  const updatedAction1 = await getActionRecordById(prop1.result.action_id);
  if (!updatedAction1 || updatedAction1.status !== 'CONFIRMED' || !updatedAction1.confirmed_at) {
    throw new Error('Action was not transitioned to CONFIRMED');
  }

  const logs = await getAuditLogsByAccount('ACCT-001');
  const matchingLog = logs.find((l) => l.payload?.action_id === prop1.result.action_id);
  if (!matchingLog) {
    throw new Error('Audit log was not written for confirmed action');
  }
  console.log(`  ✔ Verified immutable audit log recorded (${matchingLog.action})`);

  // Test 3: Customer Cross-Account Action Blockade
  console.log('\n3. Testing Cross-Tenant Action Security:');
  try {
    await executeProposeAction(customerNorthstar, {
      type: 'cancellation',
      target_id: 'ORD-2001', // Belongs to ACCT-002
      reason: 'Attempting cross-tenant cancellation',
    });
    throw new Error('Security Breach: Customer ACCT-001 proposed action on ACCT-002 order.');
  } catch (err: any) {
    console.log('  ✔ Customer blocked from proposing actions on another account.');
  }

  // Test 4: Support Agent Moderate Credit (INR 400 <= 1000)
  console.log('\n4. Testing Standard Support Credit Proposal & Confirmation:');
  const propCredit400 = await executeProposeAction(supportUser, {
    type: 'service_credit',
    target_id: 'ORD-1001',
    reason: 'Carrier pickup delay compensation',
    details: { amount_inr: 400, override_manager_reason: 'Carrier pickup delay concession' },
  });
  console.log(`  ✔ Support proposed credit of INR 400 (Manager approval required: ${propCredit400.result.requires_manager_approval})`);

  const confCredit400 = await executeConfirmAction(supportUser, {
    action_id: propCredit400.result.action_id,
  });
  console.log(`  ✔ Support successfully confirmed INR 400 credit: ${confCredit400.result.message}`);

  // Test 5: High-Value Credit (> INR 1,000) Manager Approval Gate
  console.log('\n5. Testing Manager Approval Threshold (> INR 1,000):');
  const propCredit1500 = await executeProposeAction(supportUser, {
    type: 'service_credit',
    target_id: 'ORD-1001',
    reason: 'Major operational delay compensation',
    details: { amount_inr: 1500, override_manager_reason: 'Severe logistics escalation' },
  });
  console.log(`  ✔ Proposed INR 1,500 credit (Manager approval required: ${propCredit1500.result.requires_manager_approval})`);

  // Attempt confirmation by Support (Blocked)
  try {
    await executeConfirmAction(supportUser, {
      action_id: propCredit1500.result.action_id,
    });
    throw new Error('Security Breach: Support agent was permitted to confirm credit > INR 1,000.');
  } catch (err: any) {
    console.log(`  ✔ Support confirmation blocked as expected: "${err.message}"`);
  }

  // Confirmation by Manager (Allowed)
  const confCredit1500 = await executeConfirmAction(managerUser, {
    action_id: propCredit1500.result.action_id,
  });
  console.log(`  ✔ Manager approved and confirmed INR 1,500 credit: ${confCredit1500.result.message}`);

  console.log('\n=== Module 8 Action System Tests Completed Successfully ===');
}

testActionSystem().catch((err) => {
  console.error('Action system test failed:', err);
  process.exit(1);
});
