import { NextRequest, NextResponse } from 'next/server';
import { runAgentTurn } from '@/agent/orchestrator/agent-loop';
import { SessionContext } from '@/types';
import {
  getAccountChatMessages,
  addAccountChatMessage,
  clearAccountChatMessages,
  StoredChatMessage,
} from '@/lib/chat-store';
import { createTicketRecord, getAccountById } from '@/lib/data-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('account_id') || 'ACCT-001';
    const role = searchParams.get('role') || undefined;
    const ticketId = searchParams.get('ticket_id') || undefined;
    const messages = getAccountChatMessages(accountId, role, ticketId);
    return NextResponse.json({ messages });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('account_id') || 'ACCT-001';
    const ticketId = searchParams.get('ticket_id') || undefined;
    clearAccountChatMessages(accountId, ticketId);
    return NextResponse.json({ success: true, messages: [] });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}

function triageTicketPriority(message: string): 'P1' | 'P2' | 'P3' {
  const text = message.toLowerCase();
  // P1 - Critical Outage, Security Incident, Platform Failure
  if (
    text.includes('outage') ||
    text.includes('500') ||
    text.includes('system down') ||
    text.includes('security') ||
    text.includes('token leak') ||
    text.includes('credential') ||
    text.includes('emergency') ||
    text.includes('production down') ||
    text.includes('all shipment creation') ||
    text.includes('all creation fail')
  ) {
    return 'P1';
  }

  // P2 - Operational Delay, Carrier Discrepancy, Damage, Theft, Rerouting
  if (
    text.includes('delay') ||
    text.includes('late') ||
    text.includes('missed') ||
    text.includes('stuck') ||
    text.includes('swiftship') ||
    text.includes('pickup') ||
    text.includes('damage') ||
    text.includes('broken') ||
    text.includes('stolen') ||
    text.includes('theft') ||
    text.includes('reroute') ||
    text.includes('redirect') ||
    text.includes('webhook') ||
    text.includes('timeout') ||
    text.includes('breach') ||
    text.includes('urgent') ||
    text.includes('delivered but') ||
    text.includes('not updated')
  ) {
    return 'P2';
  }

  // P3 - Standard inquiries, general tracking, fee calculations, documentation
  return 'P3';
}

function deriveSubjectFromMessage(message: string): string {
  const text = message.toLowerCase();
  const ordMatch = message.match(/ORD-\d+/i);
  const ordSuffix = ordMatch ? ` (${ordMatch[0].toUpperCase()})` : '';

  if (text.includes('delivered') && (text.includes('not updated') || text.includes('payment') || text.includes('paid'))) {
    return `Delivered Shipment & Payment Status Sync${ordSuffix}`;
  }
  if (text.includes('cancel') || text.includes('cancellation')) {
    return `Cancellation Request${ordSuffix}`;
  }
  if (text.includes('credit') || text.includes('refund') || text.includes('concession')) {
    return `Service Credit & Delay Compensation${ordSuffix}`;
  }
  if (text.includes('damage') || text.includes('broken') || text.includes('leaked') || text.includes('crushed')) {
    return `Physical Cargo Damage Appraisal${ordSuffix}`;
  }
  if (text.includes('stolen') || text.includes('theft') || text.includes('pilferage')) {
    return `Stolen / Missing Cargo Investigation${ordSuffix}`;
  }
  if (text.includes('reroute') || text.includes('address change') || text.includes('redirect')) {
    return `Mid-Transit Cargo Redirection${ordSuffix}`;
  }
  if (text.includes('outage') || text.includes('500') || text.includes('down')) {
    return `Platform & Carrier Outage Triage`;
  }
  if (text.includes('swiftship') || text.includes('pickup')) {
    return `SwiftShip Pickup Status Lag${ordSuffix}`;
  }
  if (text.includes('bulk') || text.includes('csv')) {
    return `Bulk CSV Upload Processing Limits`;
  }
  if (text.includes('sla') || text.includes('contract')) {
    return `Contractual SLA & Support Terms`;
  }
  if (text.includes('orders') || text.includes('shipment')) {
    return `Shipment Manifest & Tracking Inquiry`;
  }

  const cleaned = message.replace(/\n+/g, ' ').slice(0, 48).trim();
  return cleaned ? `${cleaned}...` : 'Support Inquiry';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { session, message, history, ticket_id, create_new_ticket } = body;

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

    const accountId = (session as any).account_id || 'ACCT-001';
    const isInternal = session.surface === 'internal';
    const userRole = isInternal ? (session as any).role || 'support' : 'customer';

    let effectiveTicketId = ticket_id || (session as any).ticket_id || undefined;
    let newlyCreatedTicket: any = null;
    let autoPriority: 'P1' | 'P2' | 'P3' = 'P3';

    // Auto-create ticket if in "new chat" mode on customer surface without needing a popup modal
    if (!isInternal && (create_new_ticket || !effectiveTicketId || effectiveTicketId === 'new' || effectiveTicketId === 'draft')) {
      autoPriority = triageTicketPriority(message);
      const subject = deriveSubjectFromMessage(message);

      newlyCreatedTicket = await createTicketRecord({
        account_id: accountId,
        subject,
        description: message.trim(),
        priority: autoPriority,
        status: 'open',
      });

      effectiveTicketId = newlyCreatedTicket.ticket_id;
    }

    const sessionContext: SessionContext = {
      ...session,
      account_id: accountId,
      ticket_id: effectiveTicketId,
    };

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
      ticket_id: effectiveTicketId,
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
    addAccountChatMessage(accountId, userStoredMsg, effectiveTicketId);

    // Index staff resolution into RAG operational memory and return immediately without redundant bot echo
    if (isDirectReply) {
      const cleanMsg = message.replace(/^\/(?:reply|r)\s*/i, '').replace(/^reply:\s*/i, '').trim();
      try {
        const { learnOpsResolution } = await import('@/retrieval/operational-memory');
        await learnOpsResolution({
          ticketId: effectiveTicketId || 'TKT-501',
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
        ticket_id: effectiveTicketId,
        created_ticket: newlyCreatedTicket,
        evaluated_priority: autoPriority,
      });
    }

    // 2. Execute agent loop
    const response = await runAgentTurn(sessionContext, message, history || []);

    const isEscalationTurn = response.is_escalated || response.proposed_action?.type === 'escalation';
    const escalatedTo = isEscalationTurn
      ? message.toLowerCase().includes('manager') || userRole === 'ops' || response.proposed_action?.requires_manager_approval
        ? 'manager'
        : 'ops'
      : undefined;

    // 3. Record agent response into shared chat store
    const botStoredMsg: StoredChatMessage = {
      id: `bot-${Date.now() + 1}`,
      account_id: accountId,
      ticket_id: effectiveTicketId,
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
      isEscalation: isEscalationTurn,
      escalated_to: escalatedTo,
      escalated_from: isInternal ? userRole : 'customer',
      tool_traces: response.tool_traces,
      sources: response.sources,
      proposed_action: response.proposed_action,
      isSecurityAlert: !!response.trap_scan?.traps?.some((t) => t.type === 'PROMPT_INJECTION' || t.severity === 'CRITICAL'),
    };
    addAccountChatMessage(accountId, botStoredMsg, effectiveTicketId);

    return NextResponse.json({
      ...response,
      ticket_id: effectiveTicketId,
      created_ticket: newlyCreatedTicket,
      evaluated_priority: autoPriority,
    });
  } catch (error: any) {
    console.error('[API /api/chat error]', error);
    return NextResponse.json(
      { error: error?.message || 'An unexpected error occurred in the agent turn.' },
      { status: 500 }
    );
  }
}
