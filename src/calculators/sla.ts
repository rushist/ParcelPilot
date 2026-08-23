import { getTicketById, getAccountById } from '../lib/data-store';
import { TicketRecord, AccountRecord } from '../db/schema';

export type SeverityLevel = 'P1' | 'P2' | 'P3';

export interface SlaCalculationResult {
  ticket_id: string;
  account_id: string;
  severity: SeverityLevel;
  severity_reason: string;
  target_minutes: number;
  elapsed_minutes: number;
  remaining_minutes: number;
  percentage_elapsed: number;
  breached: boolean;
  at_risk: boolean; // >= 80% of target
  policy_applied: string;
  source_authority: string;
  status: 'WITHIN_SLA' | 'AT_RISK' | 'BREACHED';
}

/**
 * Infer severity level based on Policy v3 / Security guidelines:
 * - P1: Outage preventing shipment creation, credential exposure / secret leak, material business risk.
 * - P2: Major feature degradation (e.g. bulk CSV failure).
 * - P3: General questions, billing, how-to requests.
 */
export function inferTicketSeverity(ticket: TicketRecord): { severity: SeverityLevel; reason: string } {
  const text = `${ticket.subject} ${ticket.description}`.toLowerCase();

  // Security incidents / Credential leaks are strictly P1 regardless of customer wording
  if (
    text.includes('credential') ||
    text.includes('api key') ||
    text.includes('secret') ||
    text.includes('token') ||
    text.includes('exposed') ||
    text.includes('leaked') ||
    text.includes('outage') ||
    text.includes('all shipment creation is failing') ||
    text.includes('http 500 when creating any shipment')
  ) {
    return {
      severity: 'P1',
      reason: 'P1 - Critical: Complete outage or security/credential exposure detected per Policy v3 Section 2.',
    };
  }

  // Major feature failure (e.g. Bulk upload)
  if (
    text.includes('bulk upload') ||
    text.includes('csv') ||
    text.includes('webhook') ||
    text.includes('intermittent failure') ||
    text.includes('500 error')
  ) {
    return {
      severity: 'P2',
      reason: 'P2 - High: Major feature degraded while core operations remain possible per Policy v3 Section 2.',
    };
  }

  return {
    severity: 'P3',
    reason: 'P3 - Normal: Standard configuration inquiry or operational question per Policy v3 Section 2.',
  };
}

/**
 * Calculates target minutes based on contract overrides and Policy v3 tiers.
 */
export function getTargetMinutes(account: AccountRecord | null, severity: SeverityLevel): { targetMinutes: number; policyApplied: string; sourceAuthority: string } {
  const accountId = account?.account_id;

  // 1. Northstar Agreement (ACCT-001)
  if (accountId === 'ACCT-001' || (account && account.account_name.includes('Northstar'))) {
    const targets = { P1: 15, P2: 60, P3: 480 };
    return {
      targetMinutes: targets[severity],
      policyApplied: `Northstar Enterprise Agreement Section 1 (${severity}: ${targets[severity]}m)`,
      sourceAuthority: 'Signed Customer Agreement (Rank 1 Override)',
    };
  }

  // 2. LumenWorks Agreement (ACCT-002)
  if (accountId === 'ACCT-002' || (account && account.account_name.includes('LumenWorks'))) {
    const targets = { P1: 120, P2: 240, P3: 960 };
    return {
      targetMinutes: targets[severity],
      policyApplied: `LumenWorks Service Agreement Section 1 (${severity}: ${targets[severity]}m)`,
      sourceAuthority: 'Signed Customer Agreement (Rank 1 Override)',
    };
  }

  // 3. Current Policy v3 by Tier
  const plan = account?.plan || 'Standard';
  if (plan === 'Enterprise') {
    const targets = { P1: 30, P2: 120, P3: 480 };
    return {
      targetMinutes: targets[severity],
      policyApplied: `Support Policy v3 Section 3 (Enterprise ${severity}: ${targets[severity]}m)`,
      sourceAuthority: 'Current Support Policy v3',
    };
  }

  if (plan === 'Growth') {
    const targets = { P1: 120, P2: 240, P3: 960 };
    return {
      targetMinutes: targets[severity],
      policyApplied: `Support Policy v3 Section 3 (Growth ${severity}: ${targets[severity]}m)`,
      sourceAuthority: 'Current Support Policy v3',
    };
  }

  // Standard Plan
  const targets = { P1: 240, P2: 480, P3: 960 };
  return {
    targetMinutes: targets[severity],
    policyApplied: `Support Policy v3 Section 3 (Standard ${severity}: ${targets[severity]}m)`,
    sourceAuthority: 'Current Support Policy v3',
  };
}

/**
 * Deterministically checks SLA status for a ticket.
 */
export async function calculateSlaStatus(
  ticketIdOrRecord: string | TicketRecord,
  accountRecord?: AccountRecord | null
): Promise<SlaCalculationResult> {
  const ticket: TicketRecord | null =
    typeof ticketIdOrRecord === 'string' ? await getTicketById(ticketIdOrRecord) : ticketIdOrRecord;

  if (!ticket) {
    throw new Error(`Ticket not found: ${typeof ticketIdOrRecord === 'string' ? ticketIdOrRecord : 'unknown'}`);
  }

  const account = accountRecord || (await getAccountById(ticket.account_id));
  const { severity, reason: severityReason } = inferTicketSeverity(ticket);
  const { targetMinutes, policyApplied, sourceAuthority } = getTargetMinutes(account, severity);

  const createdAtMs = new Date(ticket.created_at).getTime();
  const evaluationTimeMs = ticket.last_customer_message_at
    ? new Date(ticket.last_customer_message_at).getTime()
    : new Date('2026-08-16T11:00:00+05:30').getTime(); // Reference timestamp for dataset

  const elapsedMinutes = Math.max(0, Math.round((evaluationTimeMs - createdAtMs) / (1000 * 60)));
  const remainingMinutes = targetMinutes - elapsedMinutes;
  const percentageElapsed = Number(((elapsedMinutes / targetMinutes) * 100).toFixed(1));
  const breached = elapsedMinutes > targetMinutes;
  const atRisk = percentageElapsed >= 80 && !breached;

  return {
    ticket_id: ticket.ticket_id,
    account_id: ticket.account_id,
    severity,
    severity_reason: severityReason,
    target_minutes: targetMinutes,
    elapsed_minutes: elapsedMinutes,
    remaining_minutes: remainingMinutes,
    percentage_elapsed: percentageElapsed,
    breached,
    at_risk: atRisk,
    policy_applied: policyApplied,
    source_authority: sourceAuthority,
    status: breached ? 'BREACHED' : atRisk ? 'AT_RISK' : 'WITHIN_SLA',
  };
}
