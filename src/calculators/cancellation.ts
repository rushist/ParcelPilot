import { getOrderById, getAccountById } from '../lib/data-store';
import { OrderRecord, AccountRecord } from '../db/schema';

export interface CancellationCalculationResult {
  order_id: string;
  account_id: string;
  can_cancel: boolean;
  cancellation_fee_inr: number;
  policy_applied: string;
  source_authority: string;
  reason: string;
  elapsed_minutes_since_booking?: number;
  recommendation: 'CANCEL_FREE' | 'CANCEL_WITH_FEE' | 'REJECT_PICKED_UP' | 'REJECT_DELIVERED' | 'CANNOT_CANCEL';
}

/**
 * Deterministically calculates cancellation eligibility and fee.
 * Source Precedence:
 * 1. Northstar Agreement (ACCT-001): Zero fee for BOOKED pre-pickup cancellation regardless of time.
 * 2. Standard SOP v4:
 *    - DRAFT: Free cancellation.
 *    - BOOKED <= 30 min: Free cancellation.
 *    - BOOKED > 30 min: INR 250 fee.
 *    - PICKED_UP: Cannot cancel (return-to-origin workflow).
 *    - DELIVERED: Cannot cancel.
 */
export async function calculateCancellationFee(
  orderIdOrRecord: string | OrderRecord,
  accountRecord?: AccountRecord | null
): Promise<CancellationCalculationResult> {
  const order: OrderRecord | null =
    typeof orderIdOrRecord === 'string' ? await getOrderById(orderIdOrRecord) : orderIdOrRecord;

  if (!order) {
    throw new Error(`Order not found: ${typeof orderIdOrRecord === 'string' ? orderIdOrRecord : 'unknown'}`);
  }

  const account = accountRecord || (await getAccountById(order.account_id));

  // 1. Status: DELIVERED
  if (order.status === 'DELIVERED') {
    return {
      order_id: order.order_id,
      account_id: order.account_id,
      can_cancel: false,
      cancellation_fee_inr: 0,
      policy_applied: 'SOP v4 Section 1',
      source_authority: 'Current SOP v4',
      reason: 'Shipment has already been DELIVERED and cannot be cancelled.',
      recommendation: 'REJECT_DELIVERED',
    };
  }

  // 2. Status: PICKED_UP
  if (order.status === 'PICKED_UP') {
    return {
      order_id: order.order_id,
      account_id: order.account_id,
      can_cancel: false,
      cancellation_fee_inr: 0,
      policy_applied: 'SOP v4 Section 1 & Agreement Section 2',
      source_authority: 'Current SOP v4 / Customer Agreement',
      reason: 'Shipment has already been PICKED_UP by carrier. Direct cancellation is rejected; initiate Return-To-Origin (RTO) workflow.',
      recommendation: 'REJECT_PICKED_UP',
    };
  }

  // 3. Status: CANCELLED
  if (order.status === 'CANCELLED') {
    return {
      order_id: order.order_id,
      account_id: order.account_id,
      can_cancel: false,
      cancellation_fee_inr: 0,
      policy_applied: 'SOP v4 Section 1',
      source_authority: 'Current SOP v4',
      reason: 'Shipment is already CANCELLED.',
      recommendation: 'CANNOT_CANCEL',
    };
  }

  // 4. Status: DRAFT
  if (order.status === 'DRAFT') {
    return {
      order_id: order.order_id,
      account_id: order.account_id,
      can_cancel: true,
      cancellation_fee_inr: 0,
      policy_applied: 'SOP v4 Section 1',
      source_authority: 'Current SOP v4',
      reason: 'DRAFT shipments may be cancelled with zero fee.',
      recommendation: 'CANCEL_FREE',
    };
  }

  // 5. Status: BOOKED
  if (order.status === 'BOOKED') {
    // Check Contract Overrides (Rank 1 Precedence)
    if (order.account_id === 'ACCT-001' || (account && account.account_name.includes('Northstar'))) {
      return {
        order_id: order.order_id,
        account_id: order.account_id,
        can_cancel: true,
        cancellation_fee_inr: 0,
        policy_applied: 'Northstar Enterprise Agreement Section 2',
        source_authority: 'Signed Customer Agreement (Rank 1 Override)',
        reason: 'Northstar Enterprise Agreement Section 2 grants zero-fee cancellation for any BOOKED shipment prior to pickup, overriding standard 30-minute SOP limits.',
        recommendation: 'CANCEL_FREE',
      };
    }

    // Default SOP v4 calculation
    const bookedTime = order.booked_at ? new Date(order.booked_at).getTime() : 0;
    const requestedTime = order.cancellation_requested_at
      ? new Date(order.cancellation_requested_at).getTime()
      : Date.now();

    const elapsedMinutes = bookedTime > 0 ? Math.max(0, Math.round((requestedTime - bookedTime) / (1000 * 60))) : 0;

    if (elapsedMinutes <= 30) {
      return {
        order_id: order.order_id,
        account_id: order.account_id,
        can_cancel: true,
        cancellation_fee_inr: 0,
        elapsed_minutes_since_booking: elapsedMinutes,
        policy_applied: 'SOP v4 Section 1',
        source_authority: 'Current SOP v4',
        reason: `Cancellation requested within 30 minutes of booking (${elapsedMinutes} minutes elapsed). No cancellation fee applies.`,
        recommendation: 'CANCEL_FREE',
      };
    }

    return {
      order_id: order.order_id,
      account_id: order.account_id,
      can_cancel: true,
      cancellation_fee_inr: 250,
      elapsed_minutes_since_booking: elapsedMinutes,
      policy_applied: 'SOP v4 Section 1',
      source_authority: 'Current SOP v4',
      reason: `Cancellation requested more than 30 minutes after booking (${elapsedMinutes} minutes elapsed). Standard INR 250 fee applies per SOP Section 1.`,
      recommendation: 'CANCEL_WITH_FEE',
    };
  }

  return {
    order_id: order.order_id,
    account_id: order.account_id,
    can_cancel: false,
    cancellation_fee_inr: 0,
    policy_applied: 'SOP v4 Section 1',
    source_authority: 'Current SOP v4',
    reason: `Unknown shipment status "${order.status}".`,
    recommendation: 'CANNOT_CANCEL',
  };
}
