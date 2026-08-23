import { SessionContext, InternalRole } from '../types';
import { isCustomerSession, isInternalSession, ForbiddenError, UnauthorizedError } from './sessions';

/**
 * Validates if the active session is permitted to access the given accountId.
 * Customers: strictly restricted to their own account_id.
 * Internal staff: authorized to access any valid account.
 */
export function authorizeAccountAccess(session: SessionContext, targetAccountId: string): boolean {
  if (!session) return false;

  if (isCustomerSession(session)) {
    return session.account_id.toUpperCase() === targetAccountId.trim().toUpperCase();
  }

  if (isInternalSession(session)) {
    return true;
  }

  return false;
}

/**
 * Asserts that the session has permission to access targetAccountId.
 * Throws ForbiddenError if unauthorized.
 */
export function assertAccountAccess(session: SessionContext, targetAccountId: string): void {
  if (!authorizeAccountAccess(session, targetAccountId)) {
    if (isCustomerSession(session)) {
      throw new ForbiddenError(
        `Access Denied: Customer session (${session.account_id}) cannot access account (${targetAccountId}). Cross-tenant access is strictly prohibited.`
      );
    }
    throw new UnauthorizedError('Unauthorized access attempt.');
  }
}

/**
 * Enforces server-side account resolution.
 * - Customer session: always strictly returns session.account_id, rejecting any model-supplied account tampering.
 * - Internal session: requires a valid targetAccountId.
 */
export function enforceAccountScope(session: SessionContext, modelSuppliedAccountId?: string): string {
  if (!session) {
    throw new UnauthorizedError('Missing session context');
  }

  if (isCustomerSession(session)) {
    // If the customer or model supplied an account ID, ensure it matches the authenticated session
    if (modelSuppliedAccountId && modelSuppliedAccountId.trim().toUpperCase() !== session.account_id) {
      throw new ForbiddenError(
        `Security Boundary Breach: Attempted to query account "${modelSuppliedAccountId}" within authenticated session for "${session.account_id}".`
      );
    }
    return session.account_id;
  }

  if (isInternalSession(session)) {
    if (!modelSuppliedAccountId || !modelSuppliedAccountId.trim()) {
      throw new Error('Account ID is required for internal operations lookup.');
    }
    return modelSuppliedAccountId.trim().toUpperCase();
  }

  throw new UnauthorizedError('Unknown session type.');
}

/**
 * Validates if the internal session has the required role.
 */
export function authorizeInternalRole(session: SessionContext, allowedRoles: InternalRole[]): boolean {
  if (!isInternalSession(session)) {
    return false;
  }
  return allowedRoles.includes(session.role);
}

/**
 * Asserts role authorization for sensitive internal tools or actions.
 */
export function assertInternalRole(session: SessionContext, allowedRoles: InternalRole[], actionName: string = 'action'): void {
  if (!isInternalSession(session)) {
    throw new ForbiddenError(`Forbidden: Customer session cannot execute internal operation "${actionName}".`);
  }

  if (!allowedRoles.includes(session.role)) {
    throw new ForbiddenError(
      `Forbidden: Role "${session.role}" is not authorized for "${actionName}". Required roles: ${allowedRoles.join(', ')}.`
    );
  }
}

/**
 * Checks if the session has permission to confirm a specific state-changing action.
 * Rule: Service credits > INR 1,000 strictly require manager approval.
 */
export function authorizeActionConfirmation(
  session: SessionContext,
  actionType: string,
  payload: Record<string, any>
): { allowed: boolean; reason?: string } {
  if (!session) {
    return { allowed: false, reason: 'No session provided.' };
  }

  if (isCustomerSession(session)) {
    // Customers can only confirm actions on their own account and cannot issue service credits
    if (payload.account_id && payload.account_id !== session.account_id) {
      return { allowed: false, reason: 'Customer cannot confirm action on another account.' };
    }
    if (actionType === 'service_credit') {
      return { allowed: false, reason: 'Customer cannot self-issue service credits.' };
    }
    return { allowed: true };
  }

  if (isInternalSession(session)) {
    if (actionType === 'service_credit') {
      const creditAmount = Number(payload.amount_inr || payload.amount || 0);
      if (creditAmount > 1000 && session.role !== 'manager') {
        return {
          allowed: false,
          reason: `Policy Requirement: Service credits exceeding INR 1,000 (requested: INR ${creditAmount}) require Manager approval. Current role: ${session.role}.`,
        };
      }
    }
    return { allowed: true };
  }

  return { allowed: false, reason: 'Invalid session context.' };
}
