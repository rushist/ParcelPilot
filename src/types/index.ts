export type UserSurface = 'customer' | 'internal';
export type InternalRole = 'support' | 'ops' | 'manager';

export interface CustomerSession {
  surface: 'customer';
  account_id: string;
}

export interface InternalSession {
  surface: 'internal';
  role: InternalRole;
  user_name: string;
}

export type SessionContext = CustomerSession | InternalSession;

export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptime: number;
  environment: string;
  database: {
    status: 'connected' | 'disconnected' | 'error';
    latencyMs?: number;
    error?: string;
  };
  qdrant: {
    status: 'connected' | 'disconnected' | 'error';
    latencyMs?: number;
    error?: string;
  };
}
