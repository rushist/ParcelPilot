import fs from 'fs';
import path from 'path';

export interface StoredChatMessage {
  id: string;
  account_id: string;
  role: 'user' | 'assistant' | 'staff' | 'system';
  content: string;
  timestamp: string;
  timeLabel: string;
  speakerLabel: string;
  isDirectReply?: boolean;
  isEscalation?: boolean;
  escalated_to?: 'ops' | 'manager' | string;
  escalated_from?: 'support' | 'ops' | 'customer' | string;
  escalation_reason?: string;
  isActionConfirmation?: boolean;
  isSecurityAlert?: boolean;
  isError?: boolean;
  tool_traces?: any[];
  sources?: any[];
  proposed_action?: any;
}

const CHAT_STORE_FILE = path.join(__dirname, '../data/chat-store.json');

declare global {
  // eslint-disable-next-line no-var
  var __parcelpilotChatStore: Map<string, StoredChatMessage[]> | undefined;
}

function loadChatStore(): Map<string, StoredChatMessage[]> {
  if (global.__parcelpilotChatStore) {
    return global.__parcelpilotChatStore;
  }

  const map = new Map<string, StoredChatMessage[]>();

  if (fs.existsSync(CHAT_STORE_FILE)) {
    try {
      const content = fs.readFileSync(CHAT_STORE_FILE, 'utf8');
      const parsed = JSON.parse(content);
      for (const [accId, msgs] of Object.entries(parsed)) {
        map.set(accId.toUpperCase(), msgs as StoredChatMessage[]);
      }
    } catch (e) {
      console.warn('Failed to read chat-store.json:', e);
    }
  }

  global.__parcelpilotChatStore = map;
  return map;
}

function persistChatStore(): void {
  try {
    const store = loadChatStore();
    const obj: Record<string, StoredChatMessage[]> = {};
    for (const [k, v] of store.entries()) {
      obj[k] = v;
    }
    const dir = path.dirname(CHAT_STORE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CHAT_STORE_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) {
    console.warn('Failed to persist chat-store.json:', e);
  }
}

export function getAccountChatMessages(accountId: string, role?: string): StoredChatMessage[] {
  const store = loadChatStore();
  const cleanId = (accountId || 'GLOBAL').trim().toUpperCase();
  const allMessages = store.get(cleanId) || [];

  if (!role || role === 'support' || role === 'customer') {
    return allMessages;
  }

  if (role === 'manager') {
    // Return only messages that are escalated to Manager, require Manager approval, or high-severity alerts
    const managerFiltered = allMessages.filter((m) =>
      m.escalated_to === 'manager' ||
      m.proposed_action?.requires_manager_approval ||
      m.proposed_action?.target_role === 'manager' ||
      m.content.toLowerCase().includes('manager approval') ||
      m.content.toLowerCase().includes('escalated to manager') ||
      m.content.toLowerCase().includes('tier-2') ||
      m.isSecurityAlert
    );
    return managerFiltered.length > 0 ? managerFiltered : allMessages.filter((m) => m.isEscalation || m.proposed_action);
  }

  if (role === 'ops') {
    // Return only messages that are escalated to Ops or Manager, or operational dispatch proposals
    const opsFiltered = allMessages.filter((m) =>
      m.isEscalation ||
      m.escalated_to === 'ops' ||
      m.escalated_to === 'manager' ||
      m.proposed_action?.type === 'escalation' ||
      m.proposed_action?.type === 'ticket_update' ||
      m.proposed_action?.type === 'service_credit' ||
      m.speakerLabel.includes('OPS') ||
      m.isSecurityAlert
    );
    return opsFiltered.length > 0 ? opsFiltered : allMessages.filter((m) => m.isEscalation || m.proposed_action);
  }

  return allMessages;
}

export function addAccountChatMessage(accountId: string, message: StoredChatMessage): void {
  const store = loadChatStore();
  const cleanId = (accountId || 'GLOBAL').trim().toUpperCase();
  const list = store.get(cleanId) || [];
  list.push(message);
  store.set(cleanId, list);
  persistChatStore();
}

export function clearAccountChatMessages(accountId: string): void {
  const store = loadChatStore();
  const cleanId = (accountId || 'GLOBAL').trim().toUpperCase();
  store.set(cleanId, []);
  persistChatStore();
}
