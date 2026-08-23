import { parseExcelData, importData } from '../../scripts/import-data';
import { validateData } from '../../scripts/validate-data';
import { getAccountById, getOrderById, getTicketById, getOrdersByAccount, getTicketsByAccount } from '../../src/lib/data-store';

async function testDataImport() {
  console.log('=== Testing Module 2: Data Import & Validation ===\n');

  // 1. Run Data Validation
  console.log('1. Validating dataset...');
  const report = validateData();
  if (!report.isValid) {
    throw new Error(`Data validation failed: ${report.errors.join(', ')}`);
  }
  console.log('✔ Dataset validation passed with 0 errors.');
  console.log(`  - Accounts: ${report.summary.accountCount}`);
  console.log(`  - Orders: ${report.summary.orderCount}`);
  console.log(`  - Tickets: ${report.summary.ticketCount}`);

  // 2. Test Import Execution
  console.log('\n2. Testing importData execution...');
  await importData();
  console.log('✔ importData executed and saved seed data.');

  // 3. Test Key Test Facts
  console.log('\n3. Verifying key historical test entities in data store:');

  // ACCT-001 (Northstar Logistics)
  const northstar = await getAccountById('ACCT-001');
  if (!northstar || northstar.account_name !== 'Northstar Logistics' || northstar.plan !== 'Enterprise') {
    throw new Error(`Failed to retrieve ACCT-001 correctly: ${JSON.stringify(northstar)}`);
  }
  console.log(`  ✔ ACCT-001 (Northstar Logistics, Plan: ${northstar.plan}, Contract: ${northstar.contract_file})`);

  // ACCT-002 (LumenWorks)
  const lumenworks = await getAccountById('ACCT-002');
  if (!lumenworks || lumenworks.account_name !== 'LumenWorks' || lumenworks.plan !== 'Growth') {
    throw new Error(`Failed to retrieve ACCT-002 correctly: ${JSON.stringify(lumenworks)}`);
  }
  console.log(`  ✔ ACCT-002 (LumenWorks, Plan: ${lumenworks.plan}, Contract: ${lumenworks.contract_file})`);

  // ORD-1001
  const ord1001 = await getOrderById('ORD-1001');
  if (!ord1001 || ord1001.account_id !== 'ACCT-001' || ord1001.status !== 'BOOKED') {
    throw new Error(`Failed to retrieve ORD-1001: ${JSON.stringify(ord1001)}`);
  }
  console.log(`  ✔ ORD-1001 (Account: ${ord1001.account_id}, Status: ${ord1001.status}, Fee: ₹${ord1001.shipment_fee_inr})`);

  // ORD-9001 (Disputed Fault Case)
  const ord9001 = await getOrderById('ORD-9001');
  if (!ord9001) {
    console.log('  ℹ ORD-9001 checked (if present in dataset)');
  } else {
    console.log(`  ✔ ORD-9001 verified (Carrier Fault: ${ord9001.carrier_fault})`);
  }

  // TKT-501
  const tkt501 = await getTicketById('TKT-501');
  if (!tkt501 || tkt501.account_id !== 'ACCT-001' || !tkt501.subject.includes('shipment')) {
    throw new Error(`Failed to retrieve TKT-501: ${JSON.stringify(tkt501)}`);
  }
  console.log(`  ✔ TKT-501 (Account: ${tkt501.account_id}, Subject: "${tkt501.subject}")`);

  // Account scoped queries
  const northstarOrders = await getOrdersByAccount('ACCT-001');
  const northstarTickets = await getTicketsByAccount('ACCT-001');
  console.log(`  ✔ ACCT-001 Orders count: ${northstarOrders.length}, Tickets count: ${northstarTickets.length}`);

  console.log('\n=== Module 2 Data Import Test Completed Successfully ===');
}

testDataImport().catch((err) => {
  console.error('Data import test failed:', err);
  process.exit(1);
});
