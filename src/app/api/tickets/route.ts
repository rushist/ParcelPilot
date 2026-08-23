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
    const { account_id, subject, description, priority } = body;

    if (!account_id || !subject) {
      return NextResponse.json({ error: 'account_id and subject are required.' }, { status: 400 });
    }

    // AI determines the actual priority level based on incident severity and SOP policy
    const autoPriority = priority || triageTicketPriority(subject, description);

    const { createTicketRecord } = await import('@/lib/data-store');
    const newTicket = await createTicketRecord({
      account_id,
      subject,
      description: description || subject,
      priority: autoPriority,
      status: 'open',
    });

    return NextResponse.json({ success: true, ticket: newTicket });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
