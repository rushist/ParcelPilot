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
