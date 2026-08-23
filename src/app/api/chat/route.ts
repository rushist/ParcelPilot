import { NextRequest, NextResponse } from 'next/server';
import { runAgentTurn } from '@/agent/orchestrator/agent-loop';
import { SessionContext } from '@/types';
import {
  getAccountChatMessages,
  addAccountChatMessage,
  clearAccountChatMessages,
  StoredChatMessage,
} from '@/lib/chat-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('account_id') || 'ACCT-001';
    const messages = getAccountChatMessages(accountId);
    return NextResponse.json({ messages });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('account_id') || 'ACCT-001';
    clearAccountChatMessages(accountId);
    return NextResponse.json({ success: true, messages: [] });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { session, message, history } = body;

    if (!session || !session.surface) {
      return NextResponse.json(
        { error: 'Invalid or missing session context' },
        { status: 400 }
      );
    }

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Invalid or missing user message' },
        { status: 400 }
      );
    }

    const sessionContext: SessionContext = session;
    const accountId = (session as any).account_id || 'ACCT-001';
    const isInternal = session.surface === 'internal';
    const userRole = isInternal ? (session as any).role || 'support' : 'customer';

    const now = new Date();
    const timeLabel = now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    const isDirectReply =
      message.startsWith('/reply') ||
      message.startsWith('/r ') ||
      message.toLowerCase().startsWith('reply:');

    // 1. Record incoming user/staff message into shared chat store
    const userStoredMsg: StoredChatMessage = {
      id: `usr-${Date.now()}`,
      account_id: accountId,
      role: isInternal ? 'staff' : 'user',
      content: message,
      timestamp: now.toISOString(),
      timeLabel,
      speakerLabel: isInternal
        ? isDirectReply
          ? `STAFF (${userRole.toUpperCase()}) &bull; DIRECT DISPATCH`
          : `STAFF (${userRole.toUpperCase()})`
        : session.account_id === 'ACCT-001'
        ? 'NORTHSTAR (ACCT-001)'
        : `${session.account_id} CUSTOMER`,
      isDirectReply,
    };
    addAccountChatMessage(accountId, userStoredMsg);

    // Index staff resolution into RAG operational memory and return immediately without redundant bot echo
    if (isDirectReply) {
      const cleanMsg = message.replace(/^\/(?:reply|r)\s*/i, '').replace(/^reply:\s*/i, '').trim();
      try {
        const { learnOpsResolution } = await import('@/retrieval/operational-memory');
        await learnOpsResolution({
          ticketId: 'TKT-501',
          accountId,
          problem: `Live Incident Support for ${accountId}`,
          resolution: cleanMsg,
          operator: `STAFF (${userRole.toUpperCase()})`,
        });
      } catch (memErr) {
        console.warn('Ops learning notice:', memErr);
      }

      return NextResponse.json({
        success: true,
        message: cleanMsg,
        tool_traces: [],
        sources: [],
        isDirectReply: true,
      });
    }

    // 2. Execute agent loop
    const response = await runAgentTurn(sessionContext, message, history || []);

    // 3. Record agent response into shared chat store
    const botStoredMsg: StoredChatMessage = {
      id: `bot-${Date.now() + 1}`,
      account_id: accountId,
      role: 'assistant',
      content: response.message,
      timestamp: new Date().toISOString(),
      timeLabel: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }),
      speakerLabel: isInternal ? 'PARCELPILOT COPILOT' : 'PARCELPILOT AI',
      tool_traces: response.tool_traces,
      sources: response.sources,
      proposed_action: response.proposed_action,
      isSecurityAlert: !!response.trap_scan?.traps?.some((t) => t.type === 'PROMPT_INJECTION' || t.severity === 'CRITICAL'),
    };
    addAccountChatMessage(accountId, botStoredMsg);

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[API /api/chat error]', error);
    return NextResponse.json(
      { error: error?.message || 'An unexpected error occurred in the agent turn.' },
      { status: 500 }
    );
  }
}
