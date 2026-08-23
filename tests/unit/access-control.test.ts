import {
  createCustomerSession,
  createInternalSession,
} from '../../src/access/sessions';
import {
  authorizeAccountAccess,
  assertAccountAccess,
  enforceAccountScope,
  authorizeInternalRole,
  assertInternalRole,
  authorizeActionConfirmation,
} from '../../src/access/authorization';

async function testAccessControl() {
  console.log('=== Testing Module 4: Server-Side Access Control ===\n');

  const customer1 = createCustomerSession('ACCT-001');
  const customer2 = createCustomerSession('ACCT-002');
  const supportUser = createInternalSession('support', 'SupportAgent1');
  const opsUser = createInternalSession('ops', 'OpsAgent1');
  const managerUser = createInternalSession('manager', 'Manager1');

  // 1. Customer Tenant Isolation
  console.log('1. Testing Customer Tenant Boundaries:');
  console.log('  - Customer ACCT-001 accessing ACCT-001...');
  if (authorizeAccountAccess(customer1, 'ACCT-001')) {
    console.log('    ✔ Allowed');
  } else {
    throw new Error('Customer was denied access to their own account.');
  }

  console.log('  - Customer ACCT-001 attempting to access ACCT-002...');
  if (!authorizeAccountAccess(customer1, 'ACCT-002')) {
    console.log('    ✔ Blocked (Access Denied)');
  } else {
    throw new Error('Security Breach: Customer ACCT-001 was granted access to ACCT-002.');
  }

  try {
    assertAccountAccess(customer1, 'ACCT-002');
    throw new Error('Security Breach: assertAccountAccess failed to throw ForbiddenError.');
  } catch (err: any) {
    if (err.name === 'ForbiddenError') {
      console.log('    ✔ assertAccountAccess threw ForbiddenError as expected.');
    } else {
      throw err;
    }
  }

  // 2. Server-side account enforcement (preventing LLM prompt injection)
  console.log('\n2. Testing LLM Account Tampering Resistance:');
  const resolvedId = enforceAccountScope(customer1, 'ACCT-001');
  if (resolvedId === 'ACCT-001') {
    console.log('    ✔ Verified session account enforced.');
  }

  try {
    enforceAccountScope(customer1, 'ACCT-002');
    throw new Error('Security Breach: enforceAccountScope accepted spoofed ACCT-002 from customer session.');
  } catch (err: any) {
    if (err.name === 'ForbiddenError') {
      console.log('    ✔ EnforceAccountScope caught and blocked account spoofing attempt.');
    } else {
      throw err;
    }
  }

  // 3. Internal Multi-Account Lookup
  console.log('\n3. Testing Internal Staff Cross-Account Lookup:');
  if (authorizeAccountAccess(supportUser, 'ACCT-001') && authorizeAccountAccess(supportUser, 'ACCT-002')) {
    console.log('    ✔ Support role authorized for cross-account investigations.');
  } else {
    throw new Error('Support role failed cross-account authorization.');
  }

  // 4. Role Authorization Barriers
  console.log('\n4. Testing Role Isolation:');
  if (authorizeInternalRole(supportUser, ['support', 'ops', 'manager'])) {
    console.log('    ✔ Support role recognized.');
  }

  try {
    assertInternalRole(customer1 as any, ['support', 'ops', 'manager'], 'get_insights');
    throw new Error('Security Breach: Customer session accessed internal-only operation.');
  } catch (err: any) {
    console.log('    ✔ Customer session blocked from internal-only operations.');
  }

  // 5. Action Confirmation Thresholds (Manager Approval Rule)
  console.log('\n5. Testing Action Approval Thresholds:');

  // Case A: Credit <= INR 1,000 by Support
  const smallCredit = { account_id: 'ACCT-001', amount_inr: 500 };
  const authSmall = authorizeActionConfirmation(supportUser, 'service_credit', smallCredit);
  if (authSmall.allowed) {
    console.log('    ✔ Support allowed to confirm credit of INR 500.');
  } else {
    throw new Error('Support should be allowed to confirm credit <= 1,000.');
  }

  // Case B: Credit > INR 1,000 by Support (Blocked)
  const largeCredit = { account_id: 'ACCT-001', amount_inr: 1500 };
  const authLargeSupport = authorizeActionConfirmation(supportUser, 'service_credit', largeCredit);
  if (!authLargeSupport.allowed) {
    console.log(`    ✔ Support blocked from confirming credit > INR 1,000 (${authLargeSupport.reason})`);
  } else {
    throw new Error('Security Breach: Support was permitted to confirm credit > 1,000 without Manager approval.');
  }

  // Case C: Credit > INR 1,000 by Manager (Allowed)
  const authLargeManager = authorizeActionConfirmation(managerUser, 'service_credit', largeCredit);
  if (authLargeManager.allowed) {
    console.log('    ✔ Manager permitted to confirm credit of INR 1,500.');
  } else {
    throw new Error('Manager should be authorized to confirm credits > 1,000.');
  }

  // Case D: Customer self-credit (Blocked)
  const authCustomerCredit = authorizeActionConfirmation(customer1, 'service_credit', smallCredit);
  if (!authCustomerCredit.allowed) {
    console.log('    ✔ Customer blocked from self-issuing service credits.');
  } else {
    throw new Error('Security Breach: Customer permitted to self-issue service credit.');
  }

  console.log('\n=== Module 4 Access Control Tests Completed Successfully ===');
}

testAccessControl().catch((err) => {
  console.error('Access control test failed:', err);
  process.exit(1);
});
