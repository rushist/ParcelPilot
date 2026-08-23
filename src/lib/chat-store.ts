import fs from 'fs';
import path from 'path';

export interface StoredChatMessage {
  id: string;
  account_id: string;
  ticket_id?: string;
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

export function getThreadKey(accountId: string, ticketId?: string): string {
  const cleanAcc = (accountId || 'GLOBAL').trim().toUpperCase();
  if (ticketId && ticketId.trim()) {
    return `${cleanAcc}__${ticketId.trim().toUpperCase()}`;
  }
  return cleanAcc;
}

export function getAccountChatMessages(accountId: string, role?: string, ticketId?: string): StoredChatMessage[] {
  const store = loadChatStore();
  const threadKey = getThreadKey(accountId, ticketId);
  const threadMessages = store.get(threadKey);
  const allMessages = threadMessages || (ticketId ? [] : store.get((accountId || 'GLOBAL').trim().toUpperCase()) || []);

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

export function addAccountChatMessage(accountId: string, message: StoredChatMessage, ticketId?: string): void {
  const store = loadChatStore();
  const effectiveTicketId = ticketId || message.ticket_id;
  const threadKey = getThreadKey(accountId, effectiveTicketId);
  const list = store.get(threadKey) || [];
  list.push(message);
  store.set(threadKey, list);

  // If this is a ticket thread, also record in the account master stream
  if (effectiveTicketId) {
    const mainKey = (accountId || 'GLOBAL').trim().toUpperCase();
    const mainList = store.get(mainKey) || [];
    if (!mainList.some((m) => m.id === message.id)) {
      mainList.push(message);
      store.set(mainKey, mainList);
    }
  }

  persistChatStore();
}

export function clearAccountChatMessages(accountId: string, ticketId?: string): void {
  const store = loadChatStore();
  const threadKey = getThreadKey(accountId, ticketId);
  store.set(threadKey, []);
  persistChatStore();
}

export function resetChatStoreToInitial(): void {
  delete global.__parcelpilotChatStore;
  if (fs.existsSync(CHAT_STORE_FILE)) {
    try {
      fs.unlinkSync(CHAT_STORE_FILE);
    } catch (e) {
      console.warn('Failed to delete chat store file during reset:', e);
    }
  }
}
