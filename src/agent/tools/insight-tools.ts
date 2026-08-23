import { SessionContext } from '../../types';
import { assertInternalRole } from '../../access/authorization';
import { getInsights, InsightQueryType, InsightResult } from '../../insights';
import { ToolExecutionResult, ToolExecutionTrace } from './data-tools';

export interface GetInsightsArgs {
  query_type: InsightQueryType;
  params?: Record<string, any> | string;
}

/**
 * executeGetInsights
 * INTERNAL ONLY tool for proactive issue detection and analytics.
 */
export async function executeGetInsights(
  session: SessionContext,
  args: GetInsightsArgs
): Promise<ToolExecutionResult<InsightResult>> {
  const start = Date.now();

  // Enforce role boundary: Customers cannot call get_insights
  assertInternalRole(session, ['support', 'ops', 'manager'], 'get_insights');

  if (!args || !args.query_type) {
    throw new Error('Missing "query_type" parameter for get_insights tool');
  }

  let parsedParams: Record<string, any> = {};
  if (typeof args.params === 'string') {
    try {
      parsedParams = JSON.parse(args.params);
    } catch {
      parsedParams = { raw_params: args.params };
    }
  } else if (args.params) {
    parsedParams = args.params;
  }

  const result = await getInsights(args.query_type, parsedParams);
  const durationMs = Date.now() - start;

  const trace: ToolExecutionTrace = {
    tool: 'get_insights',
    inputs: { query_type: args.query_type, params: parsedParams },
    durationMs,
    session: {
      surface: session.surface,
      account_id: (session as any).account_id,
      role: (session as any).role,
    },
    success: true,
  };

  return {
    tool: 'get_insights',
    result,
    trace,
  };
}
