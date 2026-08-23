import { SessionContext } from '../types';
import { isCustomerSession, isInternalSession } from '../access/sessions';
import { assertAccountAccess } from '../access/authorization';
import { getOrderById, getTicketById, getAccountById } from '../lib/data-store';
import { calculateCancellationFee } from '../calculators/cancellation';
import { calculateServiceCredit } from '../calculators/service-credit';
import { createActionRecord } from './store';
import { ActionRecord } from '../db/schema';

export type ActionType = 'cancellation' | 'service_credit' | 'escalation' | 'ticket_update' | 'follow_up_task';

export interface ProposeActionInput {
  type: ActionType;
  target_id: string;
  reason: string;
  details?: Record<string, any> | string;
}

export interface ProposedActionResponse {
  action_id: string;
  type: ActionType;
  account_id: string;
  target_id: string;
  status: 'PROPOSED';
  title: string;
  summary: string;
  reason: string;
  requires_manager_approval: boolean;
  requires_user_confirmation: true;
  payload: Record<string, any>;
  created_at: string;
}

export async function proposeAction(
  session: SessionContext,
  input: ProposeActionInput
): Promise<ProposedActionResponse> {
  const { type, target_id, reason } = input;
  let parsedDetails: Record<string, any> = {};
  if (typeof input.details === 'string') {
    try {
      parsedDetails = JSON.parse(input.details);
    } catch {
      parsedDetails = { raw_details: input.details };
    }
  } else if (input.details) {
    parsedDetails = input.details;
  }

  let accountId = '';
  let title = '';
  let summary = '';
  let requiresManagerApproval = false;

  // 1. Action: Cancellation
  if (type === 'cancellation') {
    const order = await getOrderById(target_id);
    if (!order) throw new Error(`Order not found: ${target_id}`);

    accountId = order.account_id;
    assertAccountAccess(session, accountId);

    const calc = await calculateCancellationFee(order);
    if (!calc.can_cancel) {
      throw new Error(`Cannot propose cancellation for ${target_id}: ${calc.reason}`);
    }

    title = `Cancel Shipment ${order.order_id}`;
    summary = `Proposed cancellation of order ${order.order_id} with cancellation fee INR ${calc.cancellation_fee_inr} (${calc.policy_applied}).`;
    parsedDetails = {
      ...parsedDetails,
      order_id: order.order_id,
      fee_inr: calc.cancellation_fee_inr,
      policy: calc.policy_applied,
    };
  }

  // 2. Action: Service Credit
  else if (type === 'service_credit') {
    if (isCustomerSession(session)) {
      throw new Error('Customers cannot directly propose or issue service credits. Please request support review.');
    }

    const order = await getOrderById(target_id);
    if (!order) throw new Error(`Order not found: ${target_id}`);

    accountId = order.account_id;
    assertAccountAccess(session, accountId);

    const calc = await calculateServiceCredit(order);
    if (calc.status === 'NEEDS_VERIFICATION') {
      throw new Error(`Cannot propose service credit: ${calc.reason}`);
    }
    if (!calc.eligible && !parsedDetails.override_manager_reason) {
      throw new Error(`Order is not eligible for service credit: ${calc.reason}`);
    }

    const creditAmount = parsedDetails.amount_inr || calc.credit_amount_inr || 300;
    requiresManagerApproval = creditAmount > 1000;

    title = `Issue Service Credit of INR ${creditAmount} for ${order.order_id}`;
    summary = `Proposed credit of INR ${creditAmount} for order ${order.order_id} (${calc.policy_applied}). ${
      requiresManagerApproval ? '⚠️ Requires Manager Approval (amount > INR 1,000).' : ''
    }`;
    parsedDetails = {
      ...parsedDetails,
      order_id: order.order_id,
      amount_inr: creditAmount,
      policy: calc.policy_applied,
      requires_manager_approval: requiresManagerApproval,
    };
  }

  // 3. Action: Escalation
  else if (type === 'escalation') {
    if (target_id.startsWith('ORD-')) {
      const order = await getOrderById(target_id);
      if (!order) throw new Error(`Order not found: ${target_id}`);
      accountId = order.account_id;
      assertAccountAccess(session, accountId);

      title = `Escalate Shipment ${order.order_id} to Priority Carrier Dispatch`;
      summary = `Immediate operational escalation requested for shipment ${order.order_id} (Carrier: ${order.carrier || 'SwiftShip'}).`;
      parsedDetails = {
        ...parsedDetails,
        order_id: order.order_id,
        carrier: order.carrier || 'SwiftShip',
        escalated_to: 'Tier-2 Carrier Dispatch & Operations',
      };
    } else {
      const ticket = await getTicketById(target_id);
      accountId = ticket ? ticket.account_id : (session as any).account_id || 'ACCT-001';
      assertAccountAccess(session, accountId);

      title = `Escalate Incident ${target_id} to Priority Operations`;
      summary = `Immediate operational escalation requested for incident ${target_id} (${ticket ? ticket.subject : 'System Support Inquiry'}).`;
      parsedDetails = {
        ...parsedDetails,
        ticket_id: target_id,
        subject: ticket ? ticket.subject : 'Support Inquiry',
        escalated_to: 'Tier-2 Operations & Engineering',
      };
    }
  }

  // 4. Action: Ticket Update
  else if (type === 'ticket_update') {
    const ticket = await getTicketById(target_id);
    accountId = ticket ? ticket.account_id : (session as any).account_id || 'ACCT-001';
    assertAccountAccess(session, accountId);

    title = `Update & Close Ticket ${target_id}`;
    summary = `Resolution and playbook note for ticket ${target_id}.`;
    parsedDetails = {
      ...parsedDetails,
      ticket_id: target_id,
      staff_note: parsedDetails.staff_note || reason || 'Inquiry concluded and operations closed.',
    };
  }

  // 5. Action: Follow-up Task
  else if (type === 'follow_up_task') {
    const account = await getAccountById(target_id);
    if (!account) throw new Error(`Account not found: ${target_id}`);

    accountId = account.account_id;
    assertAccountAccess(session, accountId);

    title = `Schedule Follow-Up Task for ${account.account_name}`;
    summary = `Create operational follow-up task for account ${account.account_id}.`;
    parsedDetails = {
      ...parsedDetails,
      account_id: account.account_id,
    };
  } else {
    throw new Error(`Unsupported action type: ${type}`);
  }

  const actionId = `ACT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const actor = isCustomerSession(session)
    ? `Customer (${session.account_id})`
    : `Internal User (${(session as any).user_name || 'Agent'} - ${(session as any).role})`;

  const record: ActionRecord = {
    id: actionId,
    type,
    payload: {
      ...parsedDetails,
      target_id,
      reason,
      title,
      summary,
      requires_manager_approval: requiresManagerApproval,
    },
    status: 'PROPOSED',
    account_id: accountId,
    created_at: new Date().toISOString(),
    created_by: actor,
    notes: reason,
  };

  await createActionRecord(record);

  return {
    action_id: actionId,
    type,
    account_id: accountId,
    target_id,
    status: 'PROPOSED',
    title,
    summary,
    reason,
    requires_manager_approval: requiresManagerApproval,
    requires_user_confirmation: true,
    payload: record.payload,
    created_at: record.created_at!,
  };
}
