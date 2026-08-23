import { createCustomerSession, createInternalSession } from '../src/access/sessions';
import { executeGetAccount, executeGetOrders, executeGetTickets } from '../src/agent/tools/data-tools';

export async function runTestTools() {
  console.log('=== Running Structured Data Tools Test Script ===\n');

  const custSession = createCustomerSession('ACCT-001');
  const intSession = createInternalSession('support', 'Maya');

  // Test 1: get_account
  console.log('1. Testing get_account...');
  const accRes = await executeGetAccount(custSession, {});
  console.log(`- Account: ${accRes.result?.account_name} (${accRes.result?.account_id}), Plan: ${accRes.result?.plan}`);
  console.log(`- Execution Trace: ${accRes.trace.tool} in ${accRes.trace.durationMs}ms`);

  // Test 2: get_orders
  console.log('\n2. Testing get_orders...');
  const ordersRes = await executeGetOrders(custSession, {});
  console.log(`- Found ${ordersRes.result.length} orders for ACCT-001`);
  const ord1001 = await executeGetOrders(custSession, { order_id: 'ORD-1001' });
  console.log(`- Specific order lookup ORD-1001: Status ${ord1001.result[0]?.status}, Fee: ₹${ord1001.result[0]?.shipment_fee_inr}`);

  // Test 3: get_tickets
  console.log('\n3. Testing get_tickets...');
  const tktRes = await executeGetTickets(custSession, {});
  console.log(`- Found ${tktRes.result.length} tickets for ACCT-001`);

  // Test 4: Internal cross-account lookup
  console.log('\n4. Testing internal cross-account lookup for ACCT-002...');
  const intAccRes = await executeGetAccount(intSession, { account_id: 'ACCT-002' });
  console.log(`- Internal staff retrieved: ${intAccRes.result?.account_name} (${intAccRes.result?.account_id})`);

  console.log('\n[PASS] All structured data tools executed successfully.');
}

if (require.main === module) {
  runTestTools()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Tools test failed:', err);
      process.exit(1);
    });
}
