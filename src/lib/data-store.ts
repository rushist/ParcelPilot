import fs from 'fs';
import path from 'path';
import { pool, checkDbConnection, query } from './db';
import { AccountRecord, OrderRecord, TicketRecord } from '../db/schema';
import { parseExcelData, SeedData } from '../../scripts/import-data';

// Singleton in-memory cache and O(1) index Maps
interface IndexedStore {
  seed: SeedData;
  accountsMap: Map<string, AccountRecord>;
  ordersMap: Map<string, OrderRecord>;
  ordersByAccountMap: Map<string, OrderRecord[]>;
  ticketsMap: Map<string, TicketRecord>;
  ticketsByAccountMap: Map<string, TicketRecord[]>;
}

const globalForStore = globalThis as unknown as {
  parcelpilotStore?: IndexedStore;
};

export function getInMemoryData(): SeedData {
  const store = getIndexedStore();
  return store.seed;
}

function getIndexedStore(): IndexedStore {
  if (globalForStore.parcelpilotStore) {
    return globalForStore.parcelpilotStore;
  }

  let seedData: SeedData | null = null;
  const jsonPath = path.join(__dirname, '../data/seed-data.json');
  if (fs.existsSync(jsonPath)) {
    try {
      const content = fs.readFileSync(jsonPath, 'utf8');
      seedData = JSON.parse(content);
    } catch (e) {
      console.warn('Failed to parse seed-data.json cache, parsing directly from Excel:', e);
    }
  }

  if (!seedData) {
    seedData = parseExcelData();
  }

  const accountsMap = new Map<string, AccountRecord>();
  const ordersMap = new Map<string, OrderRecord>();
  const ordersByAccountMap = new Map<string, OrderRecord[]>();
  const ticketsMap = new Map<string, TicketRecord>();
  const ticketsByAccountMap = new Map<string, TicketRecord[]>();

  for (const acc of seedData.accounts) {
    accountsMap.set(acc.account_id.toUpperCase(), acc);
  }

  for (const ord of seedData.orders) {
    ordersMap.set(ord.order_id.toUpperCase(), ord);
    const accId = ord.account_id.toUpperCase();
    const list = ordersByAccountMap.get(accId) || [];
    list.push(ord);
    ordersByAccountMap.set(accId, list);
  }

  for (const tkt of seedData.tickets) {
    ticketsMap.set(tkt.ticket_id.toUpperCase(), tkt);
    const accId = tkt.account_id.toUpperCase();
    const list = ticketsByAccountMap.get(accId) || [];
    list.push(tkt);
    ticketsByAccountMap.set(accId, list);
  }

  globalForStore.parcelpilotStore = {
    seed: seedData,
    accountsMap,
    ordersMap,
    ordersByAccountMap,
    ticketsMap,
    ticketsByAccountMap,
  };

  return globalForStore.parcelpilotStore;
}

export async function getAccountById(accountId: string): Promise<AccountRecord | null> {
  if (!accountId) return null;
  const cleanId = accountId.trim().toUpperCase();

  const dbHealth = await checkDbConnection();
  if (dbHealth.ok) {
    try {
      const res = await query<AccountRecord>('SELECT * FROM accounts WHERE account_id = $1', [cleanId]);
      if (res.rows.length > 0) return res.rows[0];
    } catch (err) {
      // Fallback to indexed memory store
    }
  }

  const { accountsMap } = getIndexedStore();
  return accountsMap.get(cleanId) || null;
}

export async function getAllAccounts(): Promise<AccountRecord[]> {
  const dbHealth = await checkDbConnection();
  if (dbHealth.ok) {
    try {
      const res = await query<AccountRecord>('SELECT * FROM accounts ORDER BY account_id ASC');
      if (res.rows.length > 0) return res.rows;
    } catch (err) {
      // Fallback to indexed memory store
    }
  }

  const { seed } = getIndexedStore();
  return seed.accounts;
}

export async function getOrderById(orderId: string): Promise<OrderRecord | null> {
  if (!orderId) return null;
  const cleanId = orderId.trim().toUpperCase();

  const dbHealth = await checkDbConnection();
  if (dbHealth.ok) {
    try {
      const res = await query<OrderRecord>('SELECT * FROM orders WHERE order_id = $1', [cleanId]);
      if (res.rows.length > 0) return res.rows[0];
    } catch (err) {
      // Fallback to indexed memory store
    }
  }

  const { ordersMap } = getIndexedStore();
  return ordersMap.get(cleanId) || null;
}

export async function getOrdersByAccount(
  accountId: string,
  filter?: { order_id?: string; status?: string }
): Promise<OrderRecord[]> {
  if (!accountId) return [];
  const cleanId = accountId.trim().toUpperCase();

  const dbHealth = await checkDbConnection();
  if (dbHealth.ok) {
    try {
      let sql = 'SELECT * FROM orders WHERE account_id = $1';
      const params: any[] = [cleanId];

      if (filter?.order_id) {
        params.push(filter.order_id);
        sql += ` AND order_id = $${params.length}`;
      }
      if (filter?.status) {
        params.push(filter.status);
        sql += ` AND status = $${params.length}`;
      }
      sql += ' ORDER BY booked_at DESC NULLS LAST';
      const res = await query<OrderRecord>(sql, params);
      if (res.rows.length > 0) return res.rows;
    } catch (err) {
      // Fallback to indexed memory store
    }
  }

  const { ordersByAccountMap } = getIndexedStore();
  const list = ordersByAccountMap.get(cleanId) || [];
  if (!filter?.order_id && !filter?.status) return list;

  return list.filter((o) => {
    if (filter?.order_id && o.order_id !== filter.order_id) return false;
    if (filter?.status && o.status !== filter.status) return false;
    return true;
  });
}

export async function createTicketRecord(ticket: Partial<TicketRecord> & { account_id: string; subject: string }): Promise<TicketRecord> {
  const cleanAccountId = ticket.account_id.trim().toUpperCase();
  const ticketId = ticket.ticket_id ? ticket.ticket_id.toUpperCase() : `TKT-${Math.floor(600 + Math.random() * 399)}`;
  const now = new Date().toISOString();

  const newTicket: TicketRecord = {
    ticket_id: ticketId,
    account_id: cleanAccountId,
    status: (ticket.status as any) || 'open',
    priority: ticket.priority || 'P2',
    subject: ticket.subject.trim(),
    description: ticket.description ? ticket.description.trim() : ticket.subject.trim(),
    channel: ticket.channel || 'portal',
    assigned_to: ticket.assigned_to || null,
    last_customer_message_at: now,
    historical_resolution: null,
    created_at: ticket.created_at || now,
    updated_at: now,
  };

  const dbHealth = await checkDbConnection();
  if (dbHealth.ok) {
    try {
      await query(
        `INSERT INTO tickets (ticket_id, account_id, status, subject, description, channel, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         ON CONFLICT (ticket_id) DO UPDATE 
         SET status = EXCLUDED.status, subject = EXCLUDED.subject, description = EXCLUDED.description, updated_at = NOW()`,
        [newTicket.ticket_id, newTicket.account_id, newTicket.status, newTicket.subject, newTicket.description, newTicket.channel]
      );
    } catch (err) {
      console.warn('Failed to insert ticket into PostgreSQL:', err);
    }
  }

  const { ticketsMap, ticketsByAccountMap } = getIndexedStore();
  ticketsMap.set(ticketId, newTicket);
  const accList = ticketsByAccountMap.get(cleanAccountId) || [];
  ticketsByAccountMap.set(cleanAccountId, [newTicket, ...accList.filter((t) => t.ticket_id !== ticketId)]);

  return newTicket;
}

export async function updateTicketRecord(ticket: TicketRecord): Promise<void> {
  const cleanId = ticket.ticket_id.trim().toUpperCase();
  const dbHealth = await checkDbConnection();
  if (dbHealth.ok) {
    try {
      await query(
        `UPDATE tickets 
         SET status = $1, subject = $2, description = $3, historical_resolution = $4, updated_at = NOW() 
         WHERE ticket_id = $5`,
        [ticket.status, ticket.subject, ticket.description, ticket.historical_resolution || null, cleanId]
      );
    } catch (err) {
      console.warn('Failed to update ticket in PostgreSQL:', err);
    }
  }

  const { ticketsMap } = getIndexedStore();
  ticketsMap.set(cleanId, ticket);
}

export async function getTicketById(ticketId: string): Promise<TicketRecord | null> {
  if (!ticketId) return null;
  const cleanId = ticketId.trim().toUpperCase();

  const dbHealth = await checkDbConnection();
  if (dbHealth.ok) {
    try {
      const res = await query<TicketRecord>('SELECT * FROM tickets WHERE ticket_id = $1', [cleanId]);
      if (res.rows.length > 0) return res.rows[0];
    } catch (err) {
      // Fallback to indexed memory store
    }
  }

  const { ticketsMap } = getIndexedStore();
  return ticketsMap.get(cleanId) || null;
}

export async function deleteTicketRecord(ticketId: string): Promise<void> {
  const cleanId = ticketId.trim().toUpperCase();
  const dbHealth = await checkDbConnection();
  if (dbHealth.ok) {
    try {
      await query('DELETE FROM tickets WHERE ticket_id = $1', [cleanId]);
    } catch (err) {
      console.warn('Failed to delete ticket from PostgreSQL:', err);
    }
  }

  const { ticketsMap, ticketsByAccountMap } = getIndexedStore();
  const existing = ticketsMap.get(cleanId);
  if (existing) {
    ticketsMap.delete(cleanId);
    const accList = ticketsByAccountMap.get(existing.account_id) || [];
    ticketsByAccountMap.set(
      existing.account_id,
      accList.filter((t) => t.ticket_id !== cleanId)
    );
  }
}

export async function getTicketsByAccount(
  accountId: string,
  filter?: { ticket_id?: string; status?: string }
): Promise<TicketRecord[]> {
  if (!accountId) return [];
  const cleanId = accountId.trim().toUpperCase();

  const dbHealth = await checkDbConnection();
  if (dbHealth.ok) {
    try {
      let sql = "SELECT * FROM tickets WHERE account_id = $1 AND status != 'closed' AND status != 'resolved'";
      const params: any[] = [cleanId];

      if (filter?.ticket_id) {
        params.push(filter.ticket_id);
        sql = `SELECT * FROM tickets WHERE account_id = $1 AND ticket_id = $2`;
      } else if (filter?.status) {
        params.push(filter.status);
        sql = `SELECT * FROM tickets WHERE account_id = $1 AND status = $2`;
      }
      sql += ' ORDER BY created_at DESC';
      const res = await query<TicketRecord>(sql, params);
      if (res.rows.length > 0) return res.rows;
    } catch (err) {
      // Fallback to indexed memory store
    }
  }

  const { ticketsByAccountMap } = getIndexedStore();
  const list = ticketsByAccountMap.get(cleanId) || [];
  if (!filter?.ticket_id && !filter?.status) {
    return list.filter((t) => t.status !== 'closed' && t.status !== 'resolved');
  }

  return list.filter((t) => {
    if (filter?.ticket_id && t.ticket_id !== filter.ticket_id) return false;
    if (filter?.status && t.status !== filter.status) return false;
    return true;
  });
}

export async function getAllTickets(filter?: { status?: string }): Promise<TicketRecord[]> {
  const dbHealth = await checkDbConnection();
  if (dbHealth.ok) {
    try {
      let sql = 'SELECT * FROM tickets';
      const params: any[] = [];
      if (filter?.status) {
        params.push(filter.status);
        sql += ' WHERE status = $1';
      }
      sql += ' ORDER BY created_at DESC';
      const res = await query<TicketRecord>(sql, params);
      if (res.rows.length > 0) return res.rows;
    } catch (err) {
      // Fallback to indexed memory store
    }
  }

  const { seed } = getIndexedStore();
  if (filter?.status) {
    return seed.tickets.filter((t) => t.status === filter.status);
  }
  return seed.tickets;
}

export async function getAllOrders(): Promise<OrderRecord[]> {
  const dbHealth = await checkDbConnection();
  if (dbHealth.ok) {
    try {
      const res = await query<OrderRecord>('SELECT * FROM orders ORDER BY order_id ASC');
      if (res.rows.length > 0) return res.rows;
    } catch (err) {
      // Fallback to indexed memory store
    }
  }

  const { seed } = getIndexedStore();
  return seed.orders;
}
