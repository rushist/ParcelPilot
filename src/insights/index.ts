import { detectSpikesByTopic, SpikeDetectionResult } from './spike';
import { detectSlaAtRisk, SlaRiskResult } from './sla-risk';
import { correlateKnownIssue, KnownIssueReport } from './known-issues';
import { performSecurityTriage, SecurityTriageResult } from './security';

export type InsightQueryType = 'spike_by_topic' | 'sla_at_risk' | 'known_issue_correlation' | 'security_triage';

export interface InsightParams {
  window_hours?: number;
  min_count?: number;
  threshold_pct?: number;
  ki_id?: string;
  [key: string]: any;
}

export type InsightResult =
  | { query_type: 'spike_by_topic'; data: SpikeDetectionResult }
  | { query_type: 'sla_at_risk'; data: SlaRiskResult }
  | { query_type: 'known_issue_correlation'; data: KnownIssueReport[] }
  | { query_type: 'security_triage'; data: SecurityTriageResult };

/**
 * Unified Problem 1 Operational Insights Engine
 */
export async function getInsights(queryType: InsightQueryType, params: InsightParams = {}): Promise<InsightResult> {
  switch (queryType) {
    case 'spike_by_topic': {
      const data = await detectSpikesByTopic(params.window_hours || 24, params.min_count || 2);
      return { query_type: 'spike_by_topic', data };
    }

    case 'sla_at_risk': {
      const data = await detectSlaAtRisk(params.threshold_pct || 80);
      return { query_type: 'sla_at_risk', data };
    }

    case 'known_issue_correlation': {
      const data = await correlateKnownIssue(params.ki_id);
      return { query_type: 'known_issue_correlation', data };
    }

    case 'security_triage': {
      const data = await performSecurityTriage();
      return { query_type: 'security_triage', data };
    }

    default:
      throw new Error(`Unsupported insight query type: ${queryType}`);
  }
}
