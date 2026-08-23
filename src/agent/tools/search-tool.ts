import { SessionContext } from '../../types';
import { isCustomerSession } from '../../access/sessions';
import { searchDocuments, SearchResult } from '../../retrieval/search';
import { ToolExecutionResult, ToolExecutionTrace } from './data-tools';

export interface SearchDocsArgs {
  query: string;
  include_deprecated?: boolean;
  limit?: number;
}

/**
 * executeSearchDocs
 * Implements authoritative document retrieval enforcing:
 * - Customer session tenant isolation (customer only sees general docs + own agreement)
 * - Internal session global doc access
 * - Deprecated document filtering (v2 excluded from current answers unless explicitly requested for historical context)
 * - Source authority reranking (Agreement > Policy/SOP > Product Guide/Known Issues)
 */
export async function executeSearchDocs(
  session: SessionContext,
  args: SearchDocsArgs
): Promise<ToolExecutionResult<SearchResult[]>> {
  const start = Date.now();

  if (!args || !args.query || typeof args.query !== 'string') {
    throw new Error('Missing or invalid "query" parameter for search_docs tool');
  }

  // Determine account scoping based on session
  const accountId = isCustomerSession(session) ? session.account_id : null;

  const results = await searchDocuments(args.query, {
    accountId,
    includeDeprecated: Boolean(args.include_deprecated),
    limit: args.limit || 5,
  });

  const durationMs = Date.now() - start;
  const trace: ToolExecutionTrace = {
    tool: 'search_docs',
    inputs: {
      query: args.query,
      include_deprecated: Boolean(args.include_deprecated),
      limit: args.limit || 5,
      resolved_account_id: accountId,
    },
    durationMs,
    session: {
      surface: session.surface,
      account_id: (session as any).account_id,
      role: (session as any).role,
    },
    success: true,
  };

  return {
    tool: 'search_docs',
    result: results,
    trace,
  };
}
