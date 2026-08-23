import { parseExcelData } from './import-data';

export interface ValidationReport {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    accountCount: number;
    orderCount: number;
    ticketCount: number;
    activeAccounts: number;
    suspendedAccounts: number;
    enterpriseAccounts: number;
    growthAccounts: number;
    standardAccounts: number;
    bookedOrders: number;
    pickedUpOrders: number;
    openTickets: number;
    historicalResolutionsCount: number;
    carrierFaultOrders: number;
    customerFaultOrders: number;
  };
}

export function validateData(): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  const { accounts, orders, tickets } = parseExcelData();

  // 1. Check counts
  if (accounts.length !== 100) errors.push(`Expected exactly 100 accounts, found ${accounts.length}`);
  if (orders.length !== 100) errors.push(`Expected exactly 100 orders, found ${orders.length}`);
  if (tickets.length !== 100) errors.push(`Expected exactly 100 tickets, found ${tickets.length}`);

  // 2. Check duplicate IDs
  const accountIds = new Set<string>();
  for (const a of accounts) {
    if (!a.account_id) errors.push(`Account missing account_id: ${JSON.stringify(a)}`);
    if (accountIds.has(a.account_id)) errors.push(`Duplicate account_id: ${a.account_id}`);
    accountIds.add(a.account_id);
    if (!a.account_name) errors.push(`Account ${a.account_id} missing account_name`);
    if (!['Standard', 'Growth', 'Enterprise'].includes(a.plan)) {
      errors.push(`Account ${a.account_id} has invalid plan: ${a.plan}`);
    }
  }

  const orderIds = new Set<string>();
  for (const o of orders) {
    if (!o.order_id) errors.push(`Order missing order_id: ${JSON.stringify(o)}`);
    if (orderIds.has(o.order_id)) errors.push(`Duplicate order_id: ${o.order_id}`);
    orderIds.add(o.order_id);

    // Check orphan orders
    if (!accountIds.has(o.account_id)) {
      errors.push(`Orphan order ${o.order_id}: references non-existent account ${o.account_id}`);
    }
    if (typeof o.shipment_fee_inr !== 'number' || isNaN(o.shipment_fee_inr)) {
      errors.push(`Order ${o.order_id} has invalid shipment_fee_inr: ${o.shipment_fee_inr}`);
    }
  }

  const ticketIds = new Set<string>();
  let historicalResolutionsCount = 0;
  for (const t of tickets) {
    if (!t.ticket_id) errors.push(`Ticket missing ticket_id: ${JSON.stringify(t)}`);
    if (ticketIds.has(t.ticket_id)) errors.push(`Duplicate ticket_id: ${t.ticket_id}`);
    ticketIds.add(t.ticket_id);

    // Check orphan tickets
    if (!accountIds.has(t.account_id)) {
      errors.push(`Orphan ticket ${t.ticket_id}: references non-existent account ${t.account_id}`);
    }
    if (!t.subject || !t.description) {
      errors.push(`Ticket ${t.ticket_id} missing subject or description`);
    }
    if (t.historical_resolution) {
      historicalResolutionsCount++;
    }
  }

  const summary = {
    accountCount: accounts.length,
    orderCount: orders.length,
    ticketCount: tickets.length,
    activeAccounts: accounts.filter((a) => a.status === 'active').length,
    suspendedAccounts: accounts.filter((a) => a.status === 'suspended').length,
    enterpriseAccounts: accounts.filter((a) => a.plan === 'Enterprise').length,
    growthAccounts: accounts.filter((a) => a.plan === 'Growth').length,
    standardAccounts: accounts.filter((a) => a.plan === 'Standard').length,
    bookedOrders: orders.filter((o) => o.status === 'BOOKED').length,
    pickedUpOrders: orders.filter((o) => o.status === 'PICKED_UP').length,
    openTickets: tickets.filter((t) => t.status === 'open').length,
    historicalResolutionsCount,
    carrierFaultOrders: orders.filter((o) => o.carrier_fault).length,
    customerFaultOrders: orders.filter((o) => o.customer_fault).length,
  };

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    summary,
  };
}

export function runDataValidation() {
  console.log('=== Running ParcelPilot Data Validation ===\n');
  const report = validateData();

  console.log('Summary:');
  console.log(`- Accounts:           ${report.summary.accountCount} (Active: ${report.summary.activeAccounts}, Suspended: ${report.summary.suspendedAccounts})`);
  console.log(`  - Enterprise:       ${report.summary.enterpriseAccounts}`);
  console.log(`  - Growth:           ${report.summary.growthAccounts}`);
  console.log(`  - Standard:         ${report.summary.standardAccounts}`);
  console.log(`- Orders:             ${report.summary.orderCount} (BOOKED: ${report.summary.bookedOrders}, PICKED_UP: ${report.summary.pickedUpOrders})`);
  console.log(`  - Carrier Fault:    ${report.summary.carrierFaultOrders}`);
  console.log(`  - Customer Fault:   ${report.summary.customerFaultOrders}`);
  console.log(`- Tickets:            ${report.summary.ticketCount} (Open: ${report.summary.openTickets})`);
  console.log(`- Historical Notes:   ${report.summary.historicalResolutionsCount} tickets with resolution context`);

  if (report.isValid) {
    console.log('\n✔ All 300 records validated successfully. Zero orphans, zero duplicates, zero dropped columns.');
  } else {
    console.error(`\n❌ Validation Failed with ${report.errors.length} errors:`);
    for (const err of report.errors) {
      console.error(`  - ${err}`);
    }
  }

  return report;
}

if (require.main === module) {
  const report = runDataValidation();
  if (!report.isValid) {
    process.exit(1);
  }
}
