import { NextRequest, NextResponse } from 'next/server';
import { getAllOrders, getOrdersByAccount, getOrderById } from '@/lib/data-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('order_id');
    const accountId = searchParams.get('account_id');
    const status = searchParams.get('status') || undefined;

    if (orderId) {
      const order = await getOrderById(orderId);
      if (!order) {
        return NextResponse.json({ error: `Order ${orderId} not found` }, { status: 404 });
      }
      return NextResponse.json([order]);
    }

    if (accountId) {
      const orders = await getOrdersByAccount(accountId, { status });
      return NextResponse.json(orders);
    }

    const orders = await getAllOrders();
    return NextResponse.json(orders);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
