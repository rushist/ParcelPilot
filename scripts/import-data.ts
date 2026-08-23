import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { pool, checkDbConnection } from '../src/lib/db';
import { AccountRecord, OrderRecord, TicketRecord } from '../src/db/schema';

export interface SeedData {
  accounts: AccountRecord[];
  orders: OrderRecord[];
  tickets: TicketRecord[];
}

export function parseExcelData(): SeedData {
  const possiblePaths = [
    path.resolve(process.cwd(), 'docs/ParcelPilot_Assessment_Data_populated.xlsx'),
    path.resolve(process.cwd(), 'data/ParcelPilot_Assessment_Data_populated.xlsx'),
    path.resolve(process.cwd(), 'ParcelPilot_Assessment_Data_populated.xlsx'),
    path.resolve(process.cwd(), 'docs/ParcelPilot_Assessment_Data.xlsx'),
    path.resolve(process.cwd(), 'data/ParcelPilot_Assessment_Data.xlsx'),
    path.resolve(process.cwd(), 'ParcelPilot_Assessment_Data.xlsx'),
    path.resolve(__dirname, '../docs/ParcelPilot_Assessment_Data_populated.xlsx'),
    path.resolve(__dirname, '../data/ParcelPilot_Assessment_Data_populated.xlsx'),
    path.resolve(__dirname, '../ParcelPilot_Assessment_Data_populated.xlsx'),
    path.resolve(__dirname, '../../ParcelPilot_Assessment_Data_populated.xlsx'),
    path.resolve(__dirname, '../docs/ParcelPilot_Assessment_Data.xlsx'),
    path.resolve(__dirname, '../data/ParcelPilot_Assessment_Data.xlsx'),
    path.resolve(__dirname, '../ParcelPilot_Assessment_Data.xlsx'),
    path.resolve(process.cwd(), '../ParcelPilot_Assessment_Data_populated.xlsx'),
  ];

  let filePath = '';
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      filePath = p;
      break;
    }
  }

  if (!filePath) {
    const fallbackJsonPaths = [
      path.resolve(process.cwd(), 'src/data/seed-data.json'),
      path.resolve(process.cwd(), 'data/seed-data.json'),
      path.resolve(__dirname, '../src/data/seed-data.json'),
      path.resolve(__dirname, '../data/seed-data.json'),
      path.resolve(__dirname, '../../src/data/seed-data.json'),
    ];
    for (const jsonP of fallbackJsonPaths) {
      if (fs.existsSync(jsonP)) {
        return JSON.parse(fs.readFileSync(jsonP, 'utf8'));
      }
    }
    return { accounts: [], orders: [], tickets: [] };
  }

  console.log(`Loading dataset from: ${filePath}`);
  const workbook = XLSX.readFile(filePath);

  // 1. Parse Accounts
  const rawAccounts: any[] = XLSX.utils.sheet_to_json(workbook.Sheets['accounts'] || workbook.Sheets[0]);
  const accounts: AccountRecord[] = rawAccounts.map((r) => ({
    account_id: String(r.account_id).trim(),
    account_name: String(r.account_name).trim(),
    plan: String(r.plan).trim() as any,
    status: (String(r.status || 'active').trim().toLowerCase()) as any,
    csm: r.csm ? String(r.csm).trim() : null,
    contract_file: r.contract_file ? String(r.contract_file).trim() : null,
    premium_support: Boolean(r.premium_support === true || String(r.premium_support).toUpperCase() === 'TRUE'),
    notes: r.notes ? String(r.notes).trim() : null,
  }));

  // 2. Parse Orders
  const rawOrders: any[] = XLSX.utils.sheet_to_json(workbook.Sheets['orders'] || workbook.Sheets[1]);
  const orders: OrderRecord[] = rawOrders.map((r) => ({
    order_id: String(r.order_id).trim(),
    account_id: String(r.account_id).trim(),
    carrier: String(r.carrier).trim() as any,
    status: String(r.status).trim() as any,
    booked_at: r.booked_at ? normalizeDate(r.booked_at) : null,
    pickup_window_start: r.pickup_window_start ? normalizeDate(r.pickup_window_start) : null,
    pickup_window_end: r.pickup_window_end ? normalizeDate(r.pickup_window_end) : null,
    pickup_actual_at: r.pickup_actual_at ? normalizeDate(r.pickup_actual_at) : null,
    shipment_fee_inr: Number(r.shipment_fee_inr) || 0,
    carrier_fault: Boolean(r.carrier_fault === true || String(r.carrier_fault).toUpperCase() === 'TRUE'),
    customer_fault: Boolean(r.customer_fault === true || String(r.customer_fault).toUpperCase() === 'TRUE'),
    cancellation_requested_at: r.cancellation_requested_at ? normalizeDate(r.cancellation_requested_at) : null,
    notes: r.notes ? String(r.notes).trim() : null,
  }));

  // 3. Parse Tickets
  const rawTickets: any[] = XLSX.utils.sheet_to_json(workbook.Sheets['tickets'] || workbook.Sheets[2]);
  const tickets: TicketRecord[] = rawTickets.map((r) => ({
    ticket_id: String(r.ticket_id).trim(),
    account_id: String(r.account_id).trim(),
    created_at: normalizeDate(r.created_at),
    status: (String(r.status || 'open').trim().toLowerCase()) as any,
    subject: String(r.subject).trim(),
    description: String(r.description).trim(),
    channel: r.channel ? String(r.channel).trim() : null,
    assigned_to: r.assigned_to ? String(r.assigned_to).trim() : null,
    last_customer_message_at: r.last_customer_message_at ? normalizeDate(r.last_customer_message_at) : null,
    historical_resolution: r.historical_resolution ? String(r.historical_resolution).trim() : null,
  }));

  return { accounts, orders, tickets };
}

function normalizeDate(val: any): string {
  if (!val) return '';
  if (typeof val === 'number') {
    // Excel serial date format
    const date = new Date((val - (25567 + 2)) * 86400 * 1000);
    return date.toISOString();
  }
  const str = String(val).trim();
  if (str.match(/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}(:\d{2})?$/)) {
    return new Date(str.replace(' ', 'T') + '+05:30').toISOString(); // Standardize IST operational context
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? str : d.toISOString();
}

export async function importData() {
  console.log('=== Starting ParcelPilot Data Import ===\n');

  const { accounts, orders, tickets } = parseExcelData();

  console.log(`Parsed Records:`);
  console.log(`- Accounts: ${accounts.length}`);
  console.log(`- Orders:   ${orders.length}`);
  console.log(`- Tickets:  ${tickets.length}`);

  if (accounts.length !== 100 || orders.length !== 100 || tickets.length !== 100) {
    throw new Error(`Data validation error: Expected 100 accounts, 100 orders, 100 tickets. Received ${accounts.length}, ${orders.length}, ${tickets.length}`);
  }

  // Save to normalized static cache
  const cacheDir = path.join(__dirname, '../src/data');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(cacheDir, 'seed-data.json'),
    JSON.stringify({ accounts, orders, tickets }, null, 2),
    'utf8'
  );
  console.log(`[PASS] Normalized seed data saved to src/data/seed-data.json`);

  // Insert into PostgreSQL if connected
  const dbHealth = await checkDbConnection();
  if (dbHealth.ok) {
    console.log('\nInserting records into PostgreSQL with transactional safety...');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Clear existing records
      await client.query('DELETE FROM tickets');
      await client.query('DELETE FROM orders');
      await client.query('DELETE FROM accounts');

      // Insert Accounts
      for (const a of accounts) {
        await client.query(
          `INSERT INTO accounts (account_id, account_name, plan, status, csm, contract_file, premium_support, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [a.account_id, a.account_name, a.plan, a.status, a.csm, a.contract_file, a.premium_support, a.notes]
        );
      }

      // Insert Orders
      for (const o of orders) {
        await client.query(
          `INSERT INTO orders (order_id, account_id, carrier, status, booked_at, pickup_window_start, pickup_window_end, pickup_actual_at, shipment_fee_inr, carrier_fault, customer_fault, cancellation_requested_at, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            o.order_id,
            o.account_id,
            o.carrier,
            o.status,
            o.booked_at || null,
            o.pickup_window_start || null,
            o.pickup_window_end || null,
            o.pickup_actual_at || null,
            o.shipment_fee_inr,
            o.carrier_fault,
            o.customer_fault,
            o.cancellation_requested_at || null,
            o.notes,
          ]
        );
      }

      // Insert Tickets
      for (const t of tickets) {
        await client.query(
          `INSERT INTO tickets (ticket_id, account_id, created_at, status, subject, description, channel, assigned_to, last_customer_message_at, historical_resolution)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            t.ticket_id,
            t.account_id,
            t.created_at,
            t.status,
            t.subject,
            t.description,
            t.channel,
            t.assigned_to,
            t.last_customer_message_at || null,
            t.historical_resolution,
          ]
        );
      }

      await client.query('COMMIT');
      console.log(`[PASS] Successfully inserted 100 accounts, 100 orders, and 100 tickets into PostgreSQL.`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Database insertion error:', err);
      throw err;
    } finally {
      client.release();
    }
  } else {
    console.log(`[INFO] PostgreSQL offline (${dbHealth.error}). Data indexed and ready in seed cache.`);
  }

  console.log('\n=== Data Import Completed Successfully ===');
}

if (require.main === module) {
  importData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Import Failed:', err);
      process.exit(1);
    });
}
