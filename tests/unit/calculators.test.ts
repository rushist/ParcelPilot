import { getOrderById, getTicketById } from '../../src/lib/data-store';
import { calculateCancellationFee } from '../../src/calculators/cancellation';
import { calculateServiceCredit } from '../../src/calculators/service-credit';
import { calculateSlaStatus } from '../../src/calculators/sla';
import { runCalculatorRegressionReport } from '../../scripts/test-calculators';

async function testCalculators() {
  console.log('=== Testing Module 6: Deterministic Calculators ===\n');

  // 1. Test Cancellation Calculator
  console.log('1. Testing Cancellation Fee Calculations:');

  // Trap Case 1: Northstar (ORD-1001) - Agreement Zero Fee
  const ord1001 = await getOrderById('ORD-1001');
  if (!ord1001) throw new Error('ORD-1001 missing');
  const res1001 = await calculateCancellationFee(ord1001);
  console.log(`  - ORD-1001 (Northstar, BOOKED > 30m): Fee = ₹${res1001.cancellation_fee_inr}`);
  console.log(`    Policy: ${res1001.policy_applied}`);
  if (res1001.cancellation_fee_inr !== 0 || !res1001.policy_applied.includes('Northstar')) {
    throw new Error(`ORD-1001 failed: Expected zero fee via Northstar Agreement, got ₹${res1001.cancellation_fee_inr}`);
  }
  console.log('    ✔ Northstar agreement zero-fee override verified.');

  // Case 2: Standard account order (ORD-2001) - Booked > 30m
  const ord2001 = await getOrderById('ORD-2001');
  if (!ord2001) throw new Error('ORD-2001 missing');
  const res2001 = await calculateCancellationFee(ord2001);
  console.log(`  - ORD-2001 (LumenWorks, BOOKED > 30m): Fee = ₹${res2001.cancellation_fee_inr}`);
  if (res2001.cancellation_fee_inr !== 250) {
    throw new Error(`ORD-2001 failed: Expected standard INR 250 fee, got ₹${res2001.cancellation_fee_inr}`);
  }
  console.log('    ✔ Standard SOP INR 250 fee applied after 30 min.');

  // Case 3: Picked up order (ORD-1002) - Rejected
  const ord1002 = await getOrderById('ORD-1002');
  if (!ord1002) throw new Error('ORD-1002 missing');
  const res1002 = await calculateCancellationFee(ord1002);
  console.log(`  - ORD-1002 (PICKED_UP): can_cancel = ${res1002.can_cancel}, Recommendation: ${res1002.recommendation}`);
  if (res1002.can_cancel !== false || res1002.recommendation !== 'REJECT_PICKED_UP') {
    throw new Error('PICKED_UP order cancellation was not rejected');
  }
  console.log('    ✔ PICKED_UP order cancellation correctly rejected with RTO recommendation.');

  // 2. Test Service Credit Calculator
  console.log('\n2. Testing Service Credit Calculations:');

  // Case A: Disputed Fault (ORD-9001)
  const ord9001 = await getOrderById('ORD-9001');
  if (ord9001) {
    const res9001 = await calculateServiceCredit(ord9001);
    console.log(`  - ORD-9001 (Disputed Fault): Status = ${res9001.status}, Reason: "${res9001.reason}"`);
    if (res9001.status !== 'NEEDS_VERIFICATION' || res9001.eligible !== false) {
      throw new Error('ORD-9001 failed: Disputed fault order was promised credit without verification.');
    }
    console.log('    ✔ ORD-9001 correctly flagged as NEEDS_VERIFICATION.');
  }

  // Case B: LumenWorks Custom Credit override (>4h -> fixed INR 300)
  const mockLumenWorksOrder = {
    order_id: 'ORD-TEST-LW',
    account_id: 'ACCT-002',
    carrier: 'SwiftShip',
    status: 'DELIVERED' as const,
    pickup_window_start: '2026-08-16T08:00:00+05:30',
    pickup_window_end: '2026-08-16T09:00:00+05:30',
    pickup_actual_at: '2026-08-16T14:30:00+05:30', // 5.5 hours late
    shipment_fee_inr: 2000,
    carrier_fault: true,
    customer_fault: false,
  };
  const resLw = await calculateServiceCredit(mockLumenWorksOrder as any);
  console.log(`  - LumenWorks Delay > 4h: Credit = ₹${resLw.credit_amount_inr}, Policy: ${resLw.policy_applied}`);
  if (resLw.credit_amount_inr !== 300 || !resLw.policy_applied.includes('LumenWorks')) {
    throw new Error(`LumenWorks custom credit failed: Expected ₹300 fixed credit, got ₹${resLw.credit_amount_inr}`);
  }
  console.log('    ✔ LumenWorks custom INR 300 credit override verified.');

  // Case C: Standard SOP Credit (>2h, carrier fault -> min(500, 10% fee))
  const mockStdOrder = {
    order_id: 'ORD-TEST-STD',
    account_id: 'ACCT-003',
    carrier: 'RoadRunner',
    status: 'DELIVERED' as const,
    pickup_window_start: '2026-08-16T08:00:00+05:30',
    pickup_window_end: '2026-08-16T09:00:00+05:30',
    pickup_actual_at: '2026-08-16T12:00:00+05:30', // 3 hours late
    shipment_fee_inr: 4000,
    carrier_fault: true,
    customer_fault: false,
  };
  const resStd = await calculateServiceCredit(mockStdOrder as any);
  console.log(`  - Standard Delay > 2h (Fee ₹4000): Credit = ₹${resStd.credit_amount_inr} (10% = ₹400)`);
  if (resStd.credit_amount_inr !== 400) {
    throw new Error(`Standard credit failed: Expected min(500, 400) = 400, got ${resStd.credit_amount_inr}`);
  }
  console.log('    ✔ Standard SOP min(500, 10%) calculation verified.');

  // Case D: Customer Fault Order (Ineligible)
  const mockCustFaultOrder = {
    ...mockStdOrder,
    customer_fault: true,
  };
  const resCustFault = await calculateServiceCredit(mockCustFaultOrder as any);
  if (resCustFault.eligible !== false || resCustFault.status !== 'INELIGIBLE_CUSTOMER_FAULT') {
    throw new Error('Customer fault order was incorrectly marked eligible for credit');
  }
  console.log('    ✔ Customer-fault delay correctly marked ineligible.');

  // 3. Test SLA Status Calculator
  console.log('\n3. Testing SLA Calculations & Custom Overrides:');

  // Northstar Custom SLA (TKT-501)
  const tkt501 = await getTicketById('TKT-501');
  if (!tkt501) throw new Error('TKT-501 missing');
  const resSla501 = await calculateSlaStatus(tkt501);
  console.log(`  - TKT-501 (Northstar Outage): Severity = ${resSla501.severity}, Target = ${resSla501.target_minutes}m`);
  console.log(`    Policy: ${resSla501.policy_applied}`);
  if (resSla501.target_minutes !== 15 || !resSla501.policy_applied.includes('Northstar')) {
    throw new Error(`Northstar custom SLA target failed: Expected 15m P1 target, got ${resSla501.target_minutes}m`);
  }
  console.log('    ✔ Northstar custom P1 15-minute SLA target verified.');

  // Credential Leak Ticket -> P1
  const mockSecurityTicket = {
    ticket_id: 'TKT-SEC-01',
    account_id: 'ACCT-003',
    created_at: '2026-08-16T10:00:00+05:30',
    status: 'open' as const,
    subject: 'Minor question: API key exposed on github',
    description: 'We accidentally committed our parcelpilot token to a public repository.',
  };
  const resSlaSec = await calculateSlaStatus(mockSecurityTicket as any);
  console.log(`  - Security Ticket (Customer calls it minor): Assigned Severity = ${resSlaSec.severity}`);
  if (resSlaSec.severity !== 'P1') {
    throw new Error(`Security triage failed: Expected P1 severity for exposed token, got ${resSlaSec.severity}`);
  }
  console.log('    ✔ Credential / API key leak automatically elevated to P1.');

  // 4. Run Full Regression Report
  console.log('\n4. Executing Full Dataset Regression Report:');
  await runCalculatorRegressionReport();

  console.log('\n=== Module 6 Deterministic Calculators Tests Completed Successfully ===');
}

testCalculators().catch((err) => {
  console.error('Calculators test failed:', err);
  process.exit(1);
});
