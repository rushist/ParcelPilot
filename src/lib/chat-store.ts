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

  // Pre-seed ACCT-001 with the initial inquiry transcript if empty
  if (!map.has('ACCT-001') || map.get('ACCT-001')!.length === 0) {
    map.set('ACCT-001', [
      {
        id: 'seed-1',
        account_id: 'ACCT-001',
        role: 'user',
        content: 'My shipment was picked up by SwiftShip but still shows BOOKED. Why?',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        timeLabel: '02:22:21 PM',
        speakerLabel: 'NORTHSTAR (ACCT-001)',
      },
      {
        id: 'seed-2',
        account_id: 'ACCT-001',
        role: 'assistant',
        content: '**SwiftShip Pickup Confirmation Status:**\n- **Known Delay (KI-211):** SwiftShip webhook callbacks can arrive up to **20 minutes late**. A parcel may have physically been collected by the courier while ParcelPilot still displays **BOOKED**.\n- **Guidance:** Please verify the carrier API status or allow a 20-minute buffer before concluding that pickup was missed.\n\n*Source: Product Operations Guide Section 2 (KI-211).*',
        timestamp: new Date(Date.now() - 3590000).toISOString(),
        timeLabel: '02:22:22 PM',
        speakerLabel: 'PARCELPILOT AI',
        tool_traces: [
          {
            tool: 'search_docs',
            inputs: { query: 'SwiftShip pickup confirmation delay KI-211' },
            durationMs: 228,
            session: { surface: 'customer', account_id: 'ACCT-001' },
            success: true,
          },
        ],
        sources: [
          {
            doc_id: 'DOC-PROD-GUIDE',
            section: 'Section 2 (KI-211)',
            title: 'Product Operations Guide: SwiftShip Pickup Webhook Lag',
            authority_rank: 3,
            doc_status: 'CURRENT',
            effective_date: '2024-01-01',
            text: 'SwiftShip webhook callbacks can arrive up to 20 minutes late.',
          },
        ],
      },
    ]);
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
