import { NextRequest, NextResponse } from 'next/server';
import { resetDataStoreToInitial } from '@/lib/data-store';
import { resetChatStoreToInitial } from '@/lib/chat-store';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    await resetDataStoreToInitial();
    resetChatStoreToInitial();

    return NextResponse.json({
      success: true,
      message: 'System state, tickets, orders, and conversation threads successfully reset to pristine initial state.',
    });
  } catch (error: any) {
    console.error('Reset system error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to reset system state.' },
      { status: 500 }
    );
  }
}
