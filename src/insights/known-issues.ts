import { getAllTickets, getAllAccounts } from '../lib/data-store';
import { TicketRecord } from '../db/schema';

export interface KnownIssueReport {
  known_issue_id: string;
  title: string;
  status: 'Investigating' | 'Monitoring' | 'Resolved';
  opened_date: string;
  symptom: string;
  workaround: string;
  affected_ticket_count: number;
  affected_account_count: number;
  affected_tickets: {
    ticket_id: string;
    account_id: string;
    account_name: string;
    subject: string;
    status: string;
  }[];
}

interface KnownIssueMetadata {
  id: string;
  title: string;
  status: 'Investigating' | 'Monitoring' | 'Resolved';
  opened_date: string;
  symptom: string;
  workaround: string;
  matchFn: (text: string) => boolean;
}

const KNOWN_ISSUES: KnownIssueMetadata[] = [
  {
    id: 'KI-208',
    title: 'Bulk Upload failures on large CSVs (>3,000 rows)',
    status: 'Investigating',
    opened_date: '2026-08-10',
    symptom: 'Growth and Enterprise merchants experience intermittent failures uploading CSV files above ~3,000 rows.',
    workaround: 'Split upload batches into CSV files below 3,000 rows until permanent fix is deployed. Individual single bookings unaffected.',
    matchFn: (t) =>
      t.includes('bulk upload') ||
      t.includes('csv') ||
      t.includes('4,200') ||
      t.includes('3,000') ||
      t.includes('70%') ||
      (t.includes('upload') && t.includes('fail')),
  },
  {
    id: 'KI-211',
    title: 'SwiftShip pickup webhook confirmation delay (up to 20m)',
    status: 'Monitoring',
    opened_date: '2026-08-12',
    symptom: 'SwiftShip webhook callbacks can arrive up to 20 minutes late, displaying BOOKED even after physical carrier collection.',
    workaround: 'Verify carrier API status directly or allow a 20-minute buffer before concluding a pickup failed.',
    matchFn: (t) =>
      t.includes('swiftship') ||
      t.includes('webhook') ||
      (t.includes('booked') && t.includes('pickup')) ||
      t.includes('status lag') ||
      t.includes('driver picked up but shows booked'),
  },
  {
    id: 'KI-176',
    title: 'Address validation error on PIN codes',
    status: 'Resolved',
    opened_date: '2026-07-18',
    symptom: 'Address validation failures on 6-digit postal codes.',
    workaround: 'Resolved on 18 July 2026. Do not use for new incidents unless evidence specifically matches.',
    matchFn: (t) => t.includes('address validation') || t.includes('pincode') || t.includes('postal code'),
  },
];

/**
 * Correlates open and historical tickets to known issue advisories.
 * Dynamically computes affected counts from the dataset.
 */
export async function correlateKnownIssue(kiId?: string): Promise<KnownIssueReport[]> {
  const [tickets, accounts] = await Promise.all([
    getAllTickets(),
    getAllAccounts(),
  ]);

  const accountMap = new Map(accounts.map((a) => [a.account_id, a.account_name]));
  const targetIssues = kiId
    ? KNOWN_ISSUES.filter((ki) => ki.id.toUpperCase() === kiId.trim().toUpperCase())
    : KNOWN_ISSUES;

  if (kiId && targetIssues.length === 0) {
    throw new Error(`Known issue "${kiId}" not found in advisory catalog.`);
  }

  const reports: KnownIssueReport[] = [];

  for (const ki of targetIssues) {
    const matching: TicketRecord[] = [];

    for (const ticket of tickets) {
      const text = `${ticket.subject} ${ticket.description}`.toLowerCase();
      if (ki.matchFn(text)) {
        matching.push(ticket);
      }
    }

    const distinctAccounts = Array.from(new Set(matching.map((t) => t.account_id)));

    reports.push({
      known_issue_id: ki.id,
      title: ki.title,
      status: ki.status,
      opened_date: ki.opened_date,
      symptom: ki.symptom,
      workaround: ki.workaround,
      affected_ticket_count: matching.length,
      affected_account_count: distinctAccounts.length,
      affected_tickets: matching.map((t) => ({
        ticket_id: t.ticket_id,
        account_id: t.account_id,
        account_name: accountMap.get(t.account_id) || 'Unknown',
        subject: t.subject,
        status: t.status,
      })),
    });
  }

  return reports;
}
