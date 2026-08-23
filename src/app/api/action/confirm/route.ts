import { NextRequest, NextResponse } from 'next/server';
import { confirmAction } from '@/actions/confirm';
import { SessionContext } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { session, action_id } = body;

    if (!session || !session.surface) {
      return NextResponse.json({ error: 'Invalid or missing session context.' }, { status: 400 });
    }

    if (!action_id) {
      return NextResponse.json({ error: 'Missing action_id.' }, { status: 400 });
    }

    const sessionContext: SessionContext = session;
    const confirmation = await confirmAction(sessionContext, action_id);

    return NextResponse.json(confirmation);
  } catch (error: any) {
    console.error('[API /api/action/confirm error]', error);
    return NextResponse.json(
      { error: error?.message || 'An error occurred during action confirmation.' },
      { status: 400 }
    );
  }
}
