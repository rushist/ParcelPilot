import { SessionContext } from '../../types';
import { isCustomerSession, isInternalSession } from '../../access/sessions';
import { getAccountById } from '../../lib/data-store';
import { buildCustomerSystemPrompt } from './customer-prompt';
import { buildInternalSystemPrompt } from './internal-prompt';

export async function getSystemPrompt(session: SessionContext): Promise<string> {
  if (isCustomerSession(session)) {
    const account = await getAccountById(session.account_id);
    const accountName = account?.account_name || session.account_id;
    const plan = account?.plan || 'Standard';
    return buildCustomerSystemPrompt(session.account_id, accountName, plan);
  }

  if (isInternalSession(session)) {
    return buildInternalSystemPrompt(session.role, session.user_name || 'Agent');
  }

  throw new Error('Unknown session context');
}
