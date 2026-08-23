import { SessionContext } from '../../types';
import { isCustomerSession } from '../../access/sessions';
import {
  GET_ACCOUNT_TOOL,
  GET_ORDERS_TOOL,
  GET_TICKETS_TOOL,
  SEARCH_DOCS_TOOL,
  CALC_CANCELLATION_FEE_TOOL,
  CALC_SERVICE_CREDIT_TOOL,
  CHECK_SLA_STATUS_TOOL,
  PROPOSE_ACTION_TOOL,
  CONFIRM_ACTION_TOOL,
  GET_INSIGHTS_TOOL,
  ToolDefinition,
} from '../tools/tool-definitions';
import {
  executeGetAccount,
  executeGetOrders,
  executeGetTickets,
  executeCalcCancellationFee,
  executeCalcServiceCredit,
  executeCheckSlaStatus,
  ToolExecutionResult,
} from '../tools/data-tools';
import { executeSearchDocs } from '../tools/search-tool';
import { executeProposeAction, executeConfirmAction } from '../tools/action-tools';
import { executeGetInsights } from '../tools/insight-tools';

export function getAvailableToolsForSession(session: SessionContext): ToolDefinition[] {
  const customerTools: ToolDefinition[] = [
    GET_ACCOUNT_TOOL,
    GET_ORDERS_TOOL,
    GET_TICKETS_TOOL,
    SEARCH_DOCS_TOOL,
    CALC_CANCELLATION_FEE_TOOL,
    CALC_SERVICE_CREDIT_TOOL,
    CHECK_SLA_STATUS_TOOL,
    PROPOSE_ACTION_TOOL,
    CONFIRM_ACTION_TOOL,
  ];

  if (isCustomerSession(session)) {
    return customerTools;
  }

  // Internal sessions get all tools including get_insights
  return [...customerTools, GET_INSIGHTS_TOOL];
}

export async function dispatchToolCall(
  session: SessionContext,
  toolName: string,
  args: Record<string, any>
): Promise<ToolExecutionResult> {
  switch (toolName) {
    case 'get_account':
      return await executeGetAccount(session, args);

    case 'get_orders':
      return await executeGetOrders(session, args);

    case 'get_tickets':
      return await executeGetTickets(session, args);

    case 'search_docs':
      return await executeSearchDocs(session, args as any);

    case 'calc_cancellation_fee':
      return await executeCalcCancellationFee(session, args as any);

    case 'calc_service_credit':
      return await executeCalcServiceCredit(session, args as any);

    case 'check_sla_status':
      return await executeCheckSlaStatus(session, args as any);

    case 'propose_action':
      return await executeProposeAction(session, args as any);

    case 'confirm_action':
      return await executeConfirmAction(session, args as any);

    case 'get_insights':
      return await executeGetInsights(session, args as any);

    default:
      throw new Error(`Tool "${toolName}" is not recognized or permitted.`);
  }
}
