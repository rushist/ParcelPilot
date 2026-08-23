import { NextResponse } from 'next/server';
import { getAllAccounts, getAccountById } from '@/lib/data-store';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('account_id');

    if (accountId) {
      const account = await getAccountById(accountId);
      if (!account) {
        return NextResponse.json({ error: `Account ${accountId} not found` }, { status: 404 });
      }
      return NextResponse.json(account);
    }

    const accounts = await getAllAccounts();
    return NextResponse.json(accounts);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
