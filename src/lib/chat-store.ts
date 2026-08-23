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

export function getAccountChatMessages(accountId: string): StoredChatMessage[] {
  const store = loadChatStore();
  const cleanId = (accountId || 'GLOBAL').trim().toUpperCase();
  return store.get(cleanId) || [];
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
