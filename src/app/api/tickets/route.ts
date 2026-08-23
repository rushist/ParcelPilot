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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { account_id, subject, description, priority, category } = body;

    if (!account_id || !subject) {
      return NextResponse.json({ error: 'account_id and subject are required.' }, { status: 400 });
    }

    const { createTicketRecord } = await import('@/lib/data-store');
    const newTicket = await createTicketRecord({
      account_id,
      subject,
      description: description || subject,
      priority: priority || 'P2',
      status: 'open',
    });

    return NextResponse.json({ success: true, ticket: newTicket });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
