import { CustomerSession, InternalSession, SessionContext, InternalRole } from '../types';

export class UnauthorizedError extends Error {
  constructor(message: string = 'Unauthorized: Access Denied') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string = 'Forbidden: Insufficient Permissions') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export function createCustomerSession(accountId: string): CustomerSession {
  if (!accountId || typeof accountId !== 'string') {
    throw new UnauthorizedError('Invalid customer session: missing account_id');
  }
  return {
    surface: 'customer',
    account_id: accountId.trim().toUpperCase(),
  };
}

export function createInternalSession(role: InternalRole, userName: string = 'Agent'): InternalSession {
  const validRoles: InternalRole[] = ['support', 'ops', 'manager'];
  if (!validRoles.includes(role)) {
    throw new UnauthorizedError(`Invalid internal session: unknown role "${role}"`);
  }
  return {
    surface: 'internal',
    role,
    user_name: userName.trim(),
  };
}

export function isCustomerSession(session: SessionContext): session is CustomerSession {
  return session && session.surface === 'customer' && typeof (session as CustomerSession).account_id === 'string';
}

export function isInternalSession(session: SessionContext): session is InternalSession {
  return session && session.surface === 'internal' && typeof (session as InternalSession).role === 'string';
}
