import { SessionContext } from '../../types';
import { enforceAccountScope, assertAccountAccess } from '../../access/authorization';
import {
  getAccountById,
  getOrderById,
  getOrdersByAccount,
  getTicketById,
  getTicketsByAccount,
} from '../../lib/data-store';
import { AccountRecord, OrderRecord, TicketRecord } from '../../db/schema';
import { calculateCancellationFee, CancellationCalculationResult } from '../../calculators/cancellation';
import { calculateServiceCredit, ServiceCreditCalculationResult } from '../../calculators/service-credit';
import { calculateSlaStatus, SlaCalculationResult } from '../../calculators/sla';

export interface ToolExecutionTrace {
  tool: string;
  inputs: Record<string, any>;
  durationMs: number;
  session: {
    surface: string;
    account_id?: string;
    role?: string;
  };
  success: boolean;
  error?: string;
}

export interface ToolExecutionResult<T = any> {
  tool: string;
  result: T;
  trace: ToolExecutionTrace;
}

/**
 * 1. get_account
 */
export async function executeGetAccount(
  session: SessionContext,
  args: { account_id?: string }
): Promise<ToolExecutionResult<AccountRecord | null>> {
  const start = Date.now();
  const targetAccountId = enforceAccountScope(session, args?.account_id);

  assertAccountAccess(session, targetAccountId);
  const account = await getAccountById(targetAccountId);

  const durationMs = Date.now() - start;
  const trace: ToolExecutionTrace = {
    tool: 'get_account',
    inputs: { account_id: targetAccountId },
    durationMs,
    session: {
      surface: session.surface,
      account_id: (session as any).account_id,
      role: (session as any).role,
    },
    success: true,
  };

  return {
    tool: 'get_account',
    result: account,
    trace,
  };
}

/**
 * 2. get_orders
 */
export async function executeGetOrders(
  session: SessionContext,
  args: { account_id?: string; order_id?: string; status?: string }
): Promise<ToolExecutionResult<OrderRecord[]>> {
  const start = Date.now();

  if (args?.order_id) {
    const order = await getOrderById(args.order_id);
    if (!order) {
      return {
        tool: 'get_orders',
        result: [],
        trace: {
          tool: 'get_orders',
          inputs: args,
          durationMs: Date.now() - start,
          session: { surface: session.surface, account_id: (session as any).account_id, role: (session as any).role },
          success: true,
        },
      };
    }

    assertAccountAccess(session, order.account_id);
    return {
      tool: 'get_orders',
      result: [order],
      trace: {
        tool: 'get_orders',
        inputs: args,
        durationMs: Date.now() - start,
        session: { surface: session.surface, account_id: (session as any).account_id, role: (session as any).role },
        success: true,
      },
    };
  }

  const targetAccountId = enforceAccountScope(session, args?.account_id);
  assertAccountAccess(session, targetAccountId);

  const orders = await getOrdersByAccount(targetAccountId, {
    order_id: args?.order_id,
    status: args?.status,
  });

  const durationMs = Date.now() - start;
  return {
    tool: 'get_orders',
    result: orders,
    trace: {
      tool: 'get_orders',
      inputs: { account_id: targetAccountId, ...args },
      durationMs,
      session: { surface: session.surface, account_id: (session as any).account_id, role: (session as any).role },
      success: true,
    },
  };
}

/**
 * 3. get_tickets
 */
export async function executeGetTickets(
  session: SessionContext,
  args: { account_id?: string; ticket_id?: string; status?: string }
): Promise<ToolExecutionResult<TicketRecord[]>> {
  const start = Date.now();

  if (args?.ticket_id) {
    const ticket = await getTicketById(args.ticket_id);
    if (!ticket) {
      return {
        tool: 'get_tickets',
        result: [],
        trace: {
          tool: 'get_tickets',
          inputs: args,
          durationMs: Date.now() - start,
          session: { surface: session.surface, account_id: (session as any).account_id, role: (session as any).role },
          success: true,
        },
      };
    }

    assertAccountAccess(session, ticket.account_id);
    return {
      tool: 'get_tickets',
      result: [ticket],
      trace: {
        tool: 'get_tickets',
        inputs: args,
        durationMs: Date.now() - start,
        session: { surface: session.surface, account_id: (session as any).account_id, role: (session as any).role },
        success: true,
      },
    };
  }

  const targetAccountId = enforceAccountScope(session, args?.account_id);
  assertAccountAccess(session, targetAccountId);

  const tickets = await getTicketsByAccount(targetAccountId, {
    ticket_id: args?.ticket_id,
    status: args?.status,
  });

  const durationMs = Date.now() - start;
  return {
    tool: 'get_tickets',
    result: tickets,
    trace: {
      tool: 'get_tickets',
      inputs: { account_id: targetAccountId, ...args },
      durationMs,
      session: { surface: session.surface, account_id: (session as any).account_id, role: (session as any).role },
      success: true,
    },
  };
}

/**
 * 4. calc_cancellation_fee
 */
export async function executeCalcCancellationFee(
  session: SessionContext,
  args: { order_id: string }
): Promise<ToolExecutionResult<CancellationCalculationResult>> {
  const start = Date.now();
  if (!args?.order_id) {
    throw new Error('Missing required parameter "order_id" for calc_cancellation_fee');
  }

  const order = await getOrderById(args.order_id);
  if (!order) {
    throw new Error(`Order not found: ${args.order_id}`);
  }

  assertAccountAccess(session, order.account_id);
  const result = await calculateCancellationFee(order);

  const durationMs = Date.now() - start;
  return {
    tool: 'calc_cancellation_fee',
    result,
    trace: {
      tool: 'calc_cancellation_fee',
      inputs: args,
      durationMs,
      session: { surface: session.surface, account_id: (session as any).account_id, role: (session as any).role },
      success: true,
    },
  };
}

/**
 * 5. calc_service_credit
 */
export async function executeCalcServiceCredit(
  session: SessionContext,
  args: { order_id: string }
): Promise<ToolExecutionResult<ServiceCreditCalculationResult>> {
  const start = Date.now();
  if (!args?.order_id) {
    throw new Error('Missing required parameter "order_id" for calc_service_credit');
  }

  const order = await getOrderById(args.order_id);
  if (!order) {
    throw new Error(`Order not found: ${args.order_id}`);
  }

  assertAccountAccess(session, order.account_id);
  const result = await calculateServiceCredit(order);

  const durationMs = Date.now() - start;
  return {
    tool: 'calc_service_credit',
    result,
    trace: {
      tool: 'calc_service_credit',
      inputs: args,
      durationMs,
      session: { surface: session.surface, account_id: (session as any).account_id, role: (session as any).role },
      success: true,
    },
  };
}

/**
 * 6. check_sla_status
 */
export async function executeCheckSlaStatus(
  session: SessionContext,
  args: { ticket_id: string }
): Promise<ToolExecutionResult<SlaCalculationResult>> {
  const start = Date.now();
  if (!args?.ticket_id) {
    throw new Error('Missing required parameter "ticket_id" for check_sla_status');
  }

  const ticket = await getTicketById(args.ticket_id);
  if (!ticket) {
    throw new Error(`Ticket not found: ${args.ticket_id}`);
  }

  assertAccountAccess(session, ticket.account_id);
  const result = await calculateSlaStatus(ticket);

  const durationMs = Date.now() - start;
  return {
    tool: 'check_sla_status',
    result,
    trace: {
      tool: 'check_sla_status',
      inputs: args,
      durationMs,
      session: { surface: session.surface, account_id: (session as any).account_id, role: (session as any).role },
      success: true,
    },
  };
}
