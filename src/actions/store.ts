import fs from 'fs';
import path from 'path';
import { pool, checkDbConnection, query } from '../lib/db';
import { ActionRecord, AuditLogRecord } from '../db/schema';

// Persistent disk file path for offline / serverless resilience
const DATA_DIR = path.join(__dirname, '../data');
const ACTIONS_FILE = path.join(DATA_DIR, 'actions-store.json');
const AUDIT_FILE = path.join(DATA_DIR, 'audit-store.json');

// GlobalThis singleton to survive Next.js module reloads
const globalForActions = globalThis as unknown as {
  parcelpilotActions?: ActionRecord[];
  parcelpilotAuditLogs?: AuditLogRecord[];
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadActionsFromDisk(): ActionRecord[] {
  if (globalForActions.parcelpilotActions) {
    return globalForActions.parcelpilotActions;
  }
  ensureDataDir();
  if (fs.existsSync(ACTIONS_FILE)) {
    try {
      const content = fs.readFileSync(ACTIONS_FILE, 'utf8');
      globalForActions.parcelpilotActions = JSON.parse(content);
      return globalForActions.parcelpilotActions!;
    } catch (e) {
      console.warn('Failed to parse actions-store.json, initializing empty array:', e);
    }
  }
  globalForActions.parcelpilotActions = [];
  return globalForActions.parcelpilotActions;
}

function saveActionsToDisk(actions: ActionRecord[]) {
  globalForActions.parcelpilotActions = actions;
  ensureDataDir();
  try {
    fs.writeFileSync(ACTIONS_FILE, JSON.stringify(actions, null, 2), 'utf8');
  } catch (e) {
    console.warn('Failed to write actions-store.json:', e);
  }
}

function loadAuditFromDisk(): AuditLogRecord[] {
  if (globalForActions.parcelpilotAuditLogs) {
    return globalForActions.parcelpilotAuditLogs;
  }
  ensureDataDir();
  if (fs.existsSync(AUDIT_FILE)) {
    try {
      const content = fs.readFileSync(AUDIT_FILE, 'utf8');
      globalForActions.parcelpilotAuditLogs = JSON.parse(content);
      return globalForActions.parcelpilotAuditLogs!;
    } catch (e) {
      console.warn('Failed to parse audit-store.json, initializing empty array:', e);
    }
  }
  globalForActions.parcelpilotAuditLogs = [];
  return globalForActions.parcelpilotAuditLogs;
}

function saveAuditToDisk(logs: AuditLogRecord[]) {
  globalForActions.parcelpilotAuditLogs = logs;
  ensureDataDir();
  try {
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(logs, null, 2), 'utf8');
  } catch (e) {
    console.warn('Failed to write audit-store.json:', e);
  }
}

export async function createActionRecord(action: ActionRecord): Promise<ActionRecord> {
  const dbHealth = await checkDbConnection();
  if (dbHealth.ok) {
    try {
      await query(
        `INSERT INTO actions (id, type, payload, status, account_id, created_at, created_by, confirmed_at, confirmed_by, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          action.id,
          action.type,
          JSON.stringify(action.payload),
          action.status,
          action.account_id,
          action.created_at || new Date().toISOString(),
          action.created_by,
          action.confirmed_at || null,
          action.confirmed_by || null,
          action.notes || null,
        ]
      );
      return action;
    } catch (err) {
      console.warn('Postgres action insert failed, falling back to persistent disk store:', err);
    }
  }

  const actions = loadActionsFromDisk();
  const existingIdx = actions.findIndex((a) => a.id === action.id);
  if (existingIdx >= 0) {
    actions[existingIdx] = action;
  } else {
    actions.push(action);
  }
  saveActionsToDisk(actions);
  return action;
}

export async function getActionRecordById(id: string): Promise<ActionRecord | null> {
  if (!id) return null;
  const cleanId = id.trim();

  const dbHealth = await checkDbConnection();
  if (dbHealth.ok) {
    try {
      const res = await query<ActionRecord>('SELECT * FROM actions WHERE id = $1', [cleanId]);
      if (res.rows.length > 0) {
        const row = res.rows[0];
        if (typeof row.payload === 'string') {
          row.payload = JSON.parse(row.payload);
        }
        return row;
      }
    } catch (err) {
      console.warn('Postgres action query failed, checking disk store:', err);
    }
  }

  const actions = loadActionsFromDisk();
  return actions.find((a) => a.id === cleanId) || null;
}

export async function updateActionRecord(action: ActionRecord): Promise<ActionRecord> {
  const dbHealth = await checkDbConnection();
  if (dbHealth.ok) {
    try {
      await query(
        `UPDATE actions
         SET status = $1, confirmed_at = $2, confirmed_by = $3, notes = $4
         WHERE id = $5`,
        [action.status, action.confirmed_at, action.confirmed_by, action.notes, action.id]
      );
      return action;
    } catch (err) {
      console.warn('Postgres action update failed, falling back to disk store:', err);
    }
  }

  const actions = loadActionsFromDisk();
  const idx = actions.findIndex((a) => a.id === action.id);
  if (idx !== -1) {
    actions[idx] = action;
  } else {
    actions.push(action);
  }
  saveActionsToDisk(actions);
  return action;
}

export async function createAuditLog(log: AuditLogRecord): Promise<AuditLogRecord> {
  const dbHealth = await checkDbConnection();
  if (dbHealth.ok) {
    try {
      await query(
        `INSERT INTO audit_logs (id, actor, action, account_id, payload, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          log.id,
          log.actor,
          log.action,
          log.account_id || null,
          JSON.stringify(log.payload || {}),
          log.created_at || new Date().toISOString(),
        ]
      );
      return log;
    } catch (err) {
      console.warn('Postgres audit log insert failed, saving to disk store:', err);
    }
  }

  const logs = loadAuditFromDisk();
  logs.push(log);
  saveAuditToDisk(logs);
  return log;
}

export async function getAuditLogsByAccount(accountId: string): Promise<AuditLogRecord[]> {
  const dbHealth = await checkDbConnection();
  if (dbHealth.ok) {
    try {
      const res = await query<AuditLogRecord>(
        'SELECT * FROM audit_logs WHERE account_id = $1 ORDER BY created_at DESC',
        [accountId]
      );
      return res.rows.map((r) => {
        if (typeof r.payload === 'string') r.payload = JSON.parse(r.payload);
        return r;
      });
    } catch (err) {
      console.warn('Postgres audit query failed, falling back to disk store:', err);
    }
  }

  const logs = loadAuditFromDisk();
  return logs.filter((l) => l.account_id === accountId);
}

export async function getAllAuditLogs(): Promise<AuditLogRecord[]> {
  const dbHealth = await checkDbConnection();
  if (dbHealth.ok) {
    try {
      const res = await query<AuditLogRecord>('SELECT * FROM audit_logs ORDER BY created_at DESC');
      return res.rows.map((r) => {
        if (typeof r.payload === 'string') r.payload = JSON.parse(r.payload);
        return r;
      });
    } catch (err) {
      console.warn('Postgres audit query failed, falling back to disk store:', err);
    }
  }

  const logs = loadAuditFromDisk();
  return [...logs].reverse();
}
