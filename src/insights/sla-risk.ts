import { getAllTickets, getAllAccounts } from '../lib/data-store';
import { calculateSlaStatus, SlaCalculationResult } from '../calculators/sla';

export interface SlaRiskItem {
  ticket_id: string;
  account_id: string;
  account_name: string;
  subject: string;
  severity: 'P1' | 'P2' | 'P3';
  elapsed_minutes: number;
  target_minutes: number;
  remaining_minutes: number;
  percentage_elapsed: number;
  breached: boolean;
  at_risk: boolean;
  policy_applied: string;
  status: 'BREACHED' | 'AT_RISK' | 'WITHIN_SLA';
}

export interface SlaRiskResult {
  threshold_pct: number;
  total_open_tickets: number;
  breached_count: number;
  at_risk_count: number;
  items: SlaRiskItem[];
}

/**
 * Scans all open tickets to proactively discover breached or at-risk SLAs.
 */
export async function detectSlaAtRisk(thresholdPct: number = 80): Promise<SlaRiskResult> {
  const [tickets, accounts] = await Promise.all([
    getAllTickets({ status: 'open' }),
    getAllAccounts(),
  ]);

  const accountMap = new Map(accounts.map((a) => [a.account_id, a]));
  const riskItems: SlaRiskItem[] = [];

  let breachedCount = 0;
  let atRiskCount = 0;

  for (const ticket of tickets) {
    const account = accountMap.get(ticket.account_id) || null;
    const slaRes: SlaCalculationResult = await calculateSlaStatus(ticket, account);

    if (slaRes.breached) breachedCount++;
    else if (slaRes.percentage_elapsed >= thresholdPct) atRiskCount++;

    if (slaRes.breached || slaRes.percentage_elapsed >= thresholdPct) {
      riskItems.push({
        ticket_id: ticket.ticket_id,
        account_id: ticket.account_id,
        account_name: account?.account_name || 'Unknown',
        subject: ticket.subject,
        severity: slaRes.severity,
        elapsed_minutes: slaRes.elapsed_minutes,
        target_minutes: slaRes.target_minutes,
        remaining_minutes: slaRes.remaining_minutes,
        percentage_elapsed: slaRes.percentage_elapsed,
        breached: slaRes.breached,
        at_risk: slaRes.at_risk,
        policy_applied: slaRes.policy_applied,
        status: slaRes.status,
      });
    }
  }

  // Sort: Breached first, then highest percentage consumed
  riskItems.sort((a, b) => b.percentage_elapsed - a.percentage_elapsed);

  return {
    threshold_pct: thresholdPct,
    total_open_tickets: tickets.length,
    breached_count: breachedCount,
    at_risk_count: atRiskCount,
    items: riskItems,
  };
}
