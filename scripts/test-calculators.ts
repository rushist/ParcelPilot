import { getAllOrders, getAllTickets, getAllAccounts } from '../src/lib/data-store';
import { calculateCancellationFee } from '../src/calculators/cancellation';
import { calculateServiceCredit } from '../src/calculators/service-credit';
import { calculateSlaStatus } from '../src/calculators/sla';

export async function runCalculatorRegressionReport() {
  console.log('=== Running Deterministic Calculators Regression Report across all 100 Orders & Tickets ===\n');

  const [orders, tickets, accounts] = await Promise.all([
    getAllOrders(),
    getAllTickets(),
    getAllAccounts(),
  ]);

  const accountMap = new Map(accounts.map((a) => [a.account_id, a]));

  console.log(`Processing ${orders.length} orders for cancellation & service credit calculations...`);

  let freeCancellations = 0;
  let feeCancellations = 0;
  let rejectedCancellations = 0;
  let eligibleCredits = 0;
  let ineligibleCredits = 0;
  let disputedCredits = 0;
  let managerApprovalNeeded = 0;

  for (const order of orders) {
    const acc = accountMap.get(order.account_id) || null;

    // Cancellation calculation
    const cancelRes = await calculateCancellationFee(order, acc);
    if (cancelRes.can_cancel) {
      if (cancelRes.cancellation_fee_inr === 0) freeCancellations++;
      else feeCancellations++;
    } else {
      rejectedCancellations++;
    }

    // Service credit calculation
    const creditRes = await calculateServiceCredit(order, acc);
    if (creditRes.status === 'ELIGIBLE') {
      eligibleCredits++;
      if (creditRes.requires_manager_approval) managerApprovalNeeded++;
    } else if (creditRes.status === 'NEEDS_VERIFICATION') {
      disputedCredits++;
    } else {
      ineligibleCredits++;
    }
  }

  console.log('\n--- Cancellation Results ---');
  console.log(`- Free Cancellations (DRAFT, <=30m, or Agreement Waiver): ${freeCancellations}`);
  console.log(`- Paid Cancellations (>30m standard SOP INR 250 fee):        ${feeCancellations}`);
  console.log(`- Rejected Cancellations (PICKED_UP / DELIVERED):            ${rejectedCancellations}`);

  console.log('\n--- Service Credit Results ---');
  console.log(`- Eligible Credits (Carrier fault + delay threshold met):    ${eligibleCredits}`);
  console.log(`- Ineligible (Threshold not met or customer fault):          ${ineligibleCredits}`);
  console.log(`- Disputed / Needs Verification (e.g. ORD-9001):             ${disputedCredits}`);
  console.log(`- Requiring Manager Approval (> INR 1,000):                  ${managerApprovalNeeded}`);

  console.log(`\nProcessing ${tickets.length} tickets for SLA evaluations...`);
  let withinSla = 0;
  let atRiskSla = 0;
  let breachedSla = 0;
  let p1Tickets = 0;
  let p2Tickets = 0;
  let p3Tickets = 0;

  for (const ticket of tickets) {
    const acc = accountMap.get(ticket.account_id) || null;
    const slaRes = await calculateSlaStatus(ticket, acc);

    if (slaRes.severity === 'P1') p1Tickets++;
    else if (slaRes.severity === 'P2') p2Tickets++;
    else p3Tickets++;

    if (slaRes.status === 'BREACHED') breachedSla++;
    else if (slaRes.status === 'AT_RISK') atRiskSla++;
    else withinSla++;
  }

  console.log('\n--- SLA Status Results ---');
  console.log(`- Severity Tiers: P1 (${p1Tickets}), P2 (${p2Tickets}), P3 (${p3Tickets})`);
  console.log(`- SLA Compliance: Within SLA (${withinSla}), At Risk >=80% (${atRiskSla}), Breached (${breachedSla})`);

  console.log('\n✔ Calculator regression evaluation completed successfully.');
}

if (require.main === module) {
  runCalculatorRegressionReport()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Calculator regression failed:', err);
      process.exit(1);
    });
}
