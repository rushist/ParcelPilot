import { SessionContext } from '../../types';
import { proposeAction, ProposeActionInput, ProposedActionResponse } from '../../actions/propose';
import { confirmAction, ConfirmedActionResponse } from '../../actions/confirm';
import { ToolExecutionResult, ToolExecutionTrace } from './data-tools';

/**
 * executeProposeAction
 * Proposes a state-changing action and creates a draft proposal for explicit UI confirmation.
 */
export async function executeProposeAction(
  session: SessionContext,
  args: ProposeActionInput
): Promise<ToolExecutionResult<ProposedActionResponse>> {
  const start = Date.now();
  const proposal = await proposeAction(session, args);
  const durationMs = Date.now() - start;

  const trace: ToolExecutionTrace = {
    tool: 'propose_action',
    inputs: args,
    durationMs,
    session: {
      surface: session.surface,
      account_id: (session as any).account_id,
      role: (session as any).role,
    },
    success: true,
  };

  return {
    tool: 'propose_action',
    result: proposal,
    trace,
  };
}

/**
 * executeConfirmAction
 * Confirms and executes a previously proposed action upon explicit user/manager approval.
 */
export async function executeConfirmAction(
  session: SessionContext,
  args: { action_id: string }
): Promise<ToolExecutionResult<ConfirmedActionResponse>> {
  const start = Date.now();
  const confirmation = await confirmAction(session, args.action_id);
  const durationMs = Date.now() - start;

  const trace: ToolExecutionTrace = {
    tool: 'confirm_action',
    inputs: args,
    durationMs,
    session: {
      surface: session.surface,
      account_id: (session as any).account_id,
      role: (session as any).role,
    },
    success: true,
  };

  return {
    tool: 'confirm_action',
    result: confirmation,
    trace,
  };
}
