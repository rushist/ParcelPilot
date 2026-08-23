import { SessionContext } from '../types';
import { isCustomerSession } from '../access/sessions';
import { assertAccountAccess, authorizeActionConfirmation } from '../access/authorization';
import { getActionRecordById, updateActionRecord, createAuditLog } from './store';
import { ActionRecord, AuditLogRecord } from '../db/schema';

export interface ConfirmedActionResponse {
  action_id: string;
  type: string;
  account_id: string;
  status: 'CONFIRMED' | 'EXECUTED';
  title: string;
  confirmed_at: string;
  confirmed_by: string;
  audit_log_id: string;
  execution_details: Record<string, any>;
  message: string;
}

export async function confirmAction(
  session: SessionContext,
  actionId: string
): Promise<ConfirmedActionResponse> {
  if (!actionId || typeof actionId !== 'string') {
    throw new Error('Invalid or missing action_id');
  }

  const action = await getActionRecordById(actionId);
  if (!action) {
    throw new Error(`Proposed action with ID "${actionId}" not found.`);
  }

  if (action.status !== 'PROPOSED') {
    if (action.status === 'CONFIRMED' || action.status === 'EXECUTED') {
      const actionTitle = action.payload?.title || `Action ${action.type}`;
      return {
        action_id: action.id,
        type: action.type,
        account_id: action.account_id,
        status: 'CONFIRMED',
        title: actionTitle,
        confirmed_at: action.confirmed_at || new Date().toISOString(),
        confirmed_by: action.confirmed_by || 'System',
        audit_log_id: `AUD-${action.id}`,
        execution_details: action.payload,
        message: `Action "${actionTitle}" is already confirmed and recorded in the audit log.`,
      };
    }
    throw new Error(`Action "${actionId}" cannot be confirmed because it is already "${action.status}".`);
  }

  // Enforce account boundary
  assertAccountAccess(session, action.account_id);

  // Enforce role authorization (e.g. Manager approval for credits > 1000)
  const auth = authorizeActionConfirmation(session, action.type, action.payload);
  if (!auth.allowed) {
    throw new Error(`Action confirmation denied: ${auth.reason}`);
  }

  const confirmedAt = new Date().toISOString();
  const actor = isCustomerSession(session)
    ? `Customer (${session.account_id})`
    : `Internal User (${(session as any).user_name || 'Agent'} [${(session as any).role}])`;

  // Update Action record
  const updatedAction: ActionRecord = {
    ...action,
    status: 'CONFIRMED',
    confirmed_at: confirmedAt,
    confirmed_by: actor,
  };
  await updateActionRecord(updatedAction);

  // Write Immutable Audit Log
  const auditId = `AUD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const auditLog: AuditLogRecord = {
    id: auditId,
    actor,
    action: `CONFIRM_${action.type.toUpperCase()}`,
    account_id: action.account_id,
    payload: {
      action_id: action.id,
      type: action.type,
      payload: action.payload,
      confirmed_at: confirmedAt,
    },
    created_at: confirmedAt,
  };
  await createAuditLog(auditLog);

  const targetLabel = action.payload.ticket_id || action.payload.order_id || action.payload.target_id || 'Incident';
  let message = '';
  if (action.type === 'cancellation') {
    message = `Order ${targetLabel} cancellation successfully confirmed (fee: INR ${action.payload.fee_inr || 0}).`;
  } else if (action.type === 'service_credit') {
    message = `Service credit of INR ${action.payload.amount_inr} issued for order ${targetLabel}.`;
  } else if (action.type === 'escalation') {
    message = `Incident ${targetLabel} escalated to Tier-2 Operations & Carrier Dispatch. Live specialist dispatched.`;
  } else {
    message = `Action ${action.type} confirmed and executed.`;
  }

  // Remove closed/resolved ticket from active system records
  if (action.type === 'ticket_update') {
    try {
      const { deleteTicketRecord } = await import('../lib/data-store');
      await deleteTicketRecord(targetLabel);
    } catch (delErr) {
      console.warn('Ticket removal notice:', delErr);
    }
  }

  // Learn and vectorize operational resolution if note/resolution is provided
  if (action.type === 'ticket_update' || action.payload.staff_note || action.payload.details?.staff_note || action.payload.reason) {
    try {
      const { learnOpsResolution } = await import('../retrieval/operational-memory');
      const note = action.payload.staff_note || action.payload.details?.staff_note || action.payload.reason || message;
      await learnOpsResolution({
        ticketId: targetLabel,
        accountId: action.account_id,
        problem: `Shipment / Ticket Operation on ${targetLabel}`,
        resolution: note,
        operator: actor,
      });
    } catch (memErr) {
      console.warn('Operational memory learning notice:', memErr);
    }
  }

  // Broadcast confirmation to shared account chat store
  try {
    const { addAccountChatMessage } = await import('../lib/chat-store');
    const timeLabel = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    addAccountChatMessage(action.account_id, {
      id: `conf-${Date.now()}`,
      account_id: action.account_id,
      role: 'assistant',
      content: action.type === 'escalation'
        ? `### 🚀 Priority Specialist Dispatched\n\n- **Target Incident:** \`${targetLabel}\`\n- **Authorized By:** \`${actor}\`\n- **Status:** Custody transferred to **Tier-2 Logistics Operations & Engineering**.\n- **Audit Reference:** \`${auditId}\`\n\nA live operations specialist is now actively working this case.`
        : `### ✅ Action Executed\n\n- **Action:** \`${action.type.toUpperCase()}\` on \`${targetLabel}\`\n- **Authorized By:** \`${actor}\`\n- **Status:** **EXECUTED**\n- **Details:** ${message}\n- **Audit Reference:** \`${auditId}\``,
      timestamp: confirmedAt,
      timeLabel,
      speakerLabel: 'SYSTEM EXECUTION',
      isActionConfirmation: true,
    });
  } catch (err) {
    console.warn('Failed to broadcast action confirmation to chat store:', err);
  }

  return {
    action_id: action.id,
    type: action.type,
    account_id: action.account_id,
    status: 'CONFIRMED',
    title: action.payload.title || `Execute ${action.type}`,
    confirmed_at: confirmedAt,
    confirmed_by: actor,
    audit_log_id: auditId,
    execution_details: action.payload,
    message,
  };
}
