import { createCustomerSession, createInternalSession } from '../../src/access/sessions';
import { executeGetAccount, executeGetOrders, executeGetTickets } from '../../src/agent/tools/data-tools';

async function testDataTools() {
  console.log('=== Testing Module 5: Structured Data Tools ===\n');

  const customer1 = createCustomerSession('ACCT-001'); // Northstar
  const customer2 = createCustomerSession('ACCT-002'); // LumenWorks
  const supportUser = createInternalSession('support', 'AgentRohit');

  // 1. Test get_account
  console.log('1. Testing get_account on real records:');
  const acc1 = await executeGetAccount(customer1, {});
  if (!acc1.result || acc1.result.account_id !== 'ACCT-001' || acc1.result.account_name !== 'Northstar Logistics') {
    throw new Error(`get_account failed for ACCT-001: ${JSON.stringify(acc1)}`);
  }
  console.log(`  ✔ ACCT-001 retrieved: ${acc1.result.account_name}, Plan: ${acc1.result.plan}`);
  if (!acc1.trace || acc1.trace.tool !== 'get_account' || typeof acc1.trace.durationMs !== 'number') {
    throw new Error('get_account trace missing or malformed');
  }
  console.log(`  ✔ Trace verified (duration: ${acc1.trace.durationMs}ms)`);

  // 2. Test get_orders
  console.log('\n2. Testing get_orders on real records:');
  const orders = await executeGetOrders(customer1, {});
  if (orders.result.length === 0) {
    throw new Error('get_orders returned 0 orders for ACCT-001');
  }
  console.log(`  ✔ Retrieved ${orders.result.length} orders for ACCT-001`);

  const singleOrder = await executeGetOrders(customer1, { order_id: 'ORD-1001' });
  if (singleOrder.result.length !== 1 || singleOrder.result[0].order_id !== 'ORD-1001') {
    throw new Error('Failed to retrieve specific order ORD-1001');
  }
  console.log(`  ✔ Specific order ORD-1001 retrieved: Status ${singleOrder.result[0].status}, Fee: ₹${singleOrder.result[0].shipment_fee_inr}`);

  // 3. Test get_tickets
  console.log('\n3. Testing get_tickets on real records:');
  const tickets = await executeGetTickets(customer1, {});
  if (tickets.result.length === 0) {
    throw new Error('get_tickets returned 0 tickets for ACCT-001');
  }
  console.log(`  ✔ Retrieved ${tickets.result.length} tickets for ACCT-001`);

  const singleTicket = await executeGetTickets(customer1, { ticket_id: 'TKT-501' });
  if (singleTicket.result.length !== 1 || singleTicket.result[0].ticket_id !== 'TKT-501') {
    throw new Error('Failed to retrieve specific ticket TKT-501');
  }
  console.log(`  ✔ Specific ticket TKT-501 retrieved: "${singleTicket.result[0].subject}"`);

  // 4. Test Customer Cross-Account Access Blockade
  console.log('\n4. Testing Customer Cross-Account Blockades:');

  // Attempt A: Customer ACCT-001 querying ACCT-002 account
  try {
    await executeGetAccount(customer1, { account_id: 'ACCT-002' });
    throw new Error('Security Breach: Customer ACCT-001 was able to query ACCT-002 account info.');
  } catch (err: any) {
    if (err.name === 'ForbiddenError') {
      console.log('  ✔ Customer ACCT-001 blocked from querying ACCT-002 account details.');
    } else {
      throw err;
    }
  }

  // Attempt B: Customer ACCT-001 querying ORD-2001 (belonging to ACCT-002)
  try {
    await executeGetOrders(customer1, { order_id: 'ORD-2001' });
    throw new Error('Security Breach: Customer ACCT-001 was able to query ACCT-002 order ORD-2001.');
  } catch (err: any) {
    if (err.name === 'ForbiddenError') {
      console.log('  ✔ Customer ACCT-001 blocked from querying ACCT-002 order (ORD-2001).');
    } else {
      throw err;
    }
  }

  // Attempt C: Customer ACCT-001 querying TKT-502 (belonging to ACCT-002)
  try {
    await executeGetTickets(customer1, { ticket_id: 'TKT-502' });
    throw new Error('Security Breach: Customer ACCT-001 was able to query ACCT-002 ticket TKT-502.');
  } catch (err: any) {
    if (err.name === 'ForbiddenError') {
      console.log('  ✔ Customer ACCT-001 blocked from querying ACCT-002 ticket (TKT-502).');
    } else {
      throw err;
    }
  }

  // 5. Test Internal Multi-Account Lookup
  console.log('\n5. Testing Internal Multi-Account Lookup:');
  const intAcc1 = await executeGetAccount(supportUser, { account_id: 'ACCT-001' });
  const intAcc2 = await executeGetAccount(supportUser, { account_id: 'ACCT-002' });
  if (intAcc1.result?.account_id === 'ACCT-001' && intAcc2.result?.account_id === 'ACCT-002') {
    console.log('  ✔ Support agent successfully queried both ACCT-001 and ACCT-002.');
  } else {
    throw new Error('Internal support cross-account lookup failed');
  }

  const intOrd2001 = await executeGetOrders(supportUser, { order_id: 'ORD-2001' });
  if (intOrd2001.result[0]?.order_id === 'ORD-2001') {
    console.log('  ✔ Support agent successfully retrieved ORD-2001 (belonging to ACCT-002).');
  }

  console.log('\n=== Module 5 Structured Data Tools Tests Completed Successfully ===');
}

testDataTools().catch((err) => {
  console.error('Data tools test failed:', err);
  process.exit(1);
});
