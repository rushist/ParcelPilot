import { getAllTickets, getAllAccounts } from '../lib/data-store';

export interface SecurityIncidentItem {
  ticket_id: string;
  account_id: string;
  account_name: string;
  subject: string;
  description: string;
  severity: 'P1';
  risk_level: 'CRITICAL';
  exposed_type: 'API_KEY' | 'TOKEN' | 'CREDENTIAL' | 'AUTH_SECRET';
  created_at: string;
  recommended_actions: string[];
}

export interface SecurityTriageResult {
  total_security_incidents: number;
  critical_p1_count: number;
  incidents: SecurityIncidentItem[];
  protocol_summary: string;
}

const SECURITY_PATTERNS = [
  { pattern: /api[_\s-]?key/i, type: 'API_KEY' as const },
  { pattern: /token|jwt|bearer/i, type: 'TOKEN' as const },
  { pattern: /credential|password|secret/i, type: 'CREDENTIAL' as const },
  { pattern: /exposed|leaked|public\s+repo|github/i, type: 'AUTH_SECRET' as const },
];

/**
 * Proactively triages security exposures and credential leaks.
 * Strictly assigns P1 severity regardless of customer wording (Rule 15).
 */
export async function performSecurityTriage(): Promise<SecurityTriageResult> {
  const [tickets, accounts] = await Promise.all([
    getAllTickets({ status: 'open' }),
    getAllAccounts(),
  ]);

  const accountMap = new Map(accounts.map((a) => [a.account_id, a.account_name]));
  const incidents: SecurityIncidentItem[] = [];

  for (const ticket of tickets) {
    const text = `${ticket.subject} ${ticket.description}`.toLowerCase();
    const isSecurity =
      text.includes('api key') ||
      text.includes('credential') ||
      text.includes('secret') ||
      text.includes('token') ||
      text.includes('exposed') ||
      text.includes('leaked');

    if (isSecurity) {
      let exposedType: 'API_KEY' | 'TOKEN' | 'CREDENTIAL' | 'AUTH_SECRET' = 'API_KEY';
      for (const p of SECURITY_PATTERNS) {
        if (p.pattern.test(text)) {
          exposedType = p.type;
          break;
        }
      }

      incidents.push({
        ticket_id: ticket.ticket_id,
        account_id: ticket.account_id,
        account_name: accountMap.get(ticket.account_id) || 'Unknown',
        subject: ticket.subject,
        description: ticket.description,
        severity: 'P1',
        risk_level: 'CRITICAL',
        exposed_type: exposedType,
        created_at: ticket.created_at,
        recommended_actions: [
          'Immediate Key Revocation: Deactivate the compromised API key/token in the developer portal.',
          'Issue Rotated Credentials: Generate a fresh secret for the account contact.',
          'P1 Operational Escalation: Notify Security Operations and account CSM.',
          'Audit Log Inspection: Review carrier dispatches created within the exposure window.',
        ],
      });
    }
  }

  // Sort: newest incidents first
  incidents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return {
    total_security_incidents: incidents.length,
    critical_p1_count: incidents.length,
    incidents,
    protocol_summary:
      'Per Policy v3 Section 2 & Security Protocol, all credential/secret exposures are classified as P1 Critical incidents regardless of customer wording. Immediate containment required.',
  };
}
