import { NextRequest, NextResponse } from 'next/server';
import { getAllTickets, getTicketsByAccount, getTicketById } from '@/lib/data-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ticketId = searchParams.get('ticket_id');
    const accountId = searchParams.get('account_id');
    const status = searchParams.get('status') || undefined;

    if (ticketId) {
      const ticket = await getTicketById(ticketId);
      if (!ticket) {
        return NextResponse.json({ error: `Ticket ${ticketId} not found` }, { status: 404 });
      }
      return NextResponse.json([ticket]);
    }

    if (accountId) {
      const tickets = await getTicketsByAccount(accountId, { status });
      return NextResponse.json(tickets);
    }

    const tickets = await getAllTickets({ status });
    return NextResponse.json(tickets);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function triageTicketPriority(subject: string, description: string = ''): 'P1' | 'P2' | 'P3' {
  const combined = `${subject} ${description}`.toLowerCase();

  // P1 - Critical Outage / System Down / Security / Bulk Failure
  if (
    combined.includes('outage') ||
    combined.includes('500') ||
    combined.includes('system down') ||
    combined.includes('cannot create') ||
    combined.includes('all creation failing') ||
    combined.includes('bulk failure') ||
    combined.includes('validation failure') ||
    combined.includes('security') ||
    combined.includes('token leak') ||
    combined.includes('emergency') ||
    combined.includes('critical failure') ||
    combined.includes('production down')
  ) {
    return 'P1';
  }

  // P2 - High Priority: Operational Delay / Carrier SLA Breached / Stuck / Webhook Failure
  if (
    combined.includes('delay') ||
    combined.includes('late') ||
    combined.includes('missed') ||
    combined.includes('stuck') ||
    combined.includes('swiftship') ||
    combined.includes('pickup') ||
    combined.includes('webhook') ||
    combined.includes('timeout') ||
    combined.includes('breach') ||
    combined.includes('urgent') ||
    combined.includes('dispute') ||
    combined.includes('error')
  ) {
    return 'P2';
  }

  // P3 - Standard: General inquiries, cancellations, quotes, documentation
  return 'P3';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { account_id, subject, description } = body;

    if (!account_id || !subject) {
      return NextResponse.json({ error: 'account_id and subject are required.' }, { status: 400 });
    }

    // AI determines the actual priority level based on incident severity and SOP policy
    const autoPriority = triageTicketPriority(subject, description);

    const { createTicketRecord, getAccountById } = await import('@/lib/data-store');
    const { addAccountChatMessage } = await import('@/lib/chat-store');

    const account = await getAccountById(account_id);
    const plan = account?.plan?.toLowerCase() || 'enterprise';

    const slaMinutes = plan === 'enterprise'
      ? (autoPriority === 'P1' ? 15 : autoPriority === 'P2' ? 60 : 240)
      : plan === 'growth'
      ? (autoPriority === 'P1' ? 30 : autoPriority === 'P2' ? 120 : 480)
      : (autoPriority === 'P1' ? 60 : autoPriority === 'P2' ? 240 : 1440);

    const refinedAssessment = autoPriority === 'P1'
      ? `Critical service degradation/outage detected: "${subject}". Triaged with maximum priority under Rank 1 SLA Precedence.`
      : autoPriority === 'P2'
      ? `Operational delay / carrier dispatch latency: "${subject}". Triaged for active investigation.`
      : `Standard merchant inquiry: "${subject}".`;

    const newTicket = await createTicketRecord({
      account_id,
      subject: subject.trim(),
      description: description ? description.trim() : subject.trim(),
      priority: autoPriority,
      status: 'open',
    });

    const now = new Date();
    const timeLabel = now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    // Auto-seed user opening message in this ticket's isolated thread
    addAccountChatMessage(account_id, {
      id: `usr-${Date.now()}`,
      account_id,
      ticket_id: newTicket.ticket_id,
      role: 'user',
      content: description && description.trim() !== subject.trim()
        ? `**${subject.trim()}**\n\n${description.trim()}`
        : subject.trim(),
      timestamp: now.toISOString(),
      timeLabel,
      speakerLabel: account_id === 'ACCT-001' ? 'NORTHSTAR (ACCT-001)' : `${account_id} CUSTOMER`,
    }, newTicket.ticket_id);

    // Auto-seed assistant acknowledgment in this ticket's isolated thread
    addAccountChatMessage(account_id, {
      id: `bot-${Date.now() + 1}`,
      account_id,
      ticket_id: newTicket.ticket_id,
      role: 'assistant',
      content: `### Support Inquiry Registered (${newTicket.ticket_id})\n\nI have registered your inquiry and am reviewing the shipment details. How can I help you with this order?`,
      timestamp: new Date().toISOString(),
      timeLabel,
      speakerLabel: 'PARCELPILOT AI',
    }, newTicket.ticket_id);

    return NextResponse.json({
      success: true,
      ticket: newTicket,
      evaluated_priority: autoPriority,
      sla_minutes: slaMinutes,
      refined_assessment: refinedAssessment,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
