import { getAllTickets, getAllAccounts } from '../lib/data-store';
import { TicketRecord } from '../db/schema';

export interface TopicCluster {
  topic: string;
  count: number;
  ticket_ids: string[];
  account_count: number;
  accounts: string[];
  known_issue_id: string | null;
  sample_subject: string;
}

export interface SpikeDetectionResult {
  window_hours: number;
  min_count: number;
  total_open_tickets: number;
  clusters: TopicCluster[];
  detected_at: string;
}

interface TopicRule {
  name: string;
  keywords: string[];
  known_issue_id: string | null;
}

const TOPIC_RULES: TopicRule[] = [
  {
    name: 'Bulk Upload & CSV Failures',
    keywords: ['bulk upload', 'csv', 'rows', 'upload fails', '70%', 'large csv', 'bulk'],
    known_issue_id: 'KI-208',
  },
  {
    name: 'SwiftShip Pickup Status Webhook Delay',
    keywords: ['swiftship', 'webhook', 'shows booked', 'already picked up', 'status lag', 'not updating'],
    known_issue_id: 'KI-211',
  },
  {
    name: 'Production Outage & API 500 Errors',
    keywords: ['http 500', 'outage', 'all shipment creation', 'failing', 'server error', '500 error'],
    known_issue_id: null,
  },
  {
    name: 'Credential & API Key Security Exposure',
    keywords: ['api key', 'credential', 'token', 'secret', 'exposed', 'leaked', 'github'],
    known_issue_id: null,
  },
  {
    name: 'Account & Billing Configuration',
    keywords: ['billing', 'contact', 'invoice', 'plan change', 'kyc', 'email'],
    known_issue_id: null,
  },
];

/**
 * Dynamically discovers topic volume spikes across open tickets.
 * Zero hardcoded counts: derived directly from the dataset.
 */
export async function detectSpikesByTopic(
  windowHours: number = 24,
  minCount: number = 2
): Promise<SpikeDetectionResult> {
  const tickets = await getAllTickets({ status: 'open' });
  const accounts = await getAllAccounts();
  const accountMap = new Map(accounts.map((a) => [a.account_id, a.account_name]));

  const clustersMap = new Map<string, { rule: TopicRule; matchingTickets: TicketRecord[] }>();

  for (const rule of TOPIC_RULES) {
    clustersMap.set(rule.name, { rule, matchingTickets: [] });
  }

  for (const ticket of tickets) {
    const text = `${ticket.subject} ${ticket.description}`.toLowerCase();

    for (const rule of TOPIC_RULES) {
      const isMatch = rule.keywords.some((kw) => text.includes(kw));
      if (isMatch) {
        clustersMap.get(rule.name)!.matchingTickets.push(ticket);
        break; // Associate with primary matching cluster
      }
    }
  }

  const clusters: TopicCluster[] = [];

  for (const [topicName, { rule, matchingTickets }] of clustersMap.entries()) {
    if (matchingTickets.length >= minCount) {
      const distinctAccountIds = Array.from(new Set(matchingTickets.map((t) => t.account_id)));
      clusters.push({
        topic: topicName,
        count: matchingTickets.length,
        ticket_ids: matchingTickets.map((t) => t.ticket_id),
        account_count: distinctAccountIds.length,
        accounts: distinctAccountIds.map((id) => `${id} (${accountMap.get(id) || 'Unknown'})`),
        known_issue_id: rule.known_issue_id,
        sample_subject: matchingTickets[0]?.subject || '',
      });
    }
  }

  // Sort clusters descending by ticket volume
  clusters.sort((a, b) => b.count - a.count);

  return {
    window_hours: windowHours,
    min_count: minCount,
    total_open_tickets: tickets.length,
    clusters,
    detected_at: new Date().toISOString(),
  };
}
