export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required?: string[];
  };
}

export const GET_ACCOUNT_TOOL: ToolDefinition = {
  name: 'get_account',
  description: 'Retrieve account details, subscription plan tier, support level, and contract metadata.',
  parameters: {
    type: 'object',
    properties: {
      account_id: {
        type: 'string',
        description: 'The unique Account ID (e.g. ACCT-001). For customer sessions, this is automatically scoped.',
      },
    },
  },
};

export const GET_ORDERS_TOOL: ToolDefinition = {
  name: 'get_orders',
  description: 'Query shipments/orders for an account with optional filters for order_id and status.',
  parameters: {
    type: 'object',
    properties: {
      account_id: {
        type: 'string',
        description: 'The Account ID to fetch orders for.',
      },
      order_id: {
        type: 'string',
        description: 'Optional specific Order ID to fetch (e.g. ORD-1001).',
      },
      status: {
        type: 'string',
        enum: ['DRAFT', 'BOOKED', 'PICKED_UP', 'DELIVERED', 'CANCELLED'],
        description: 'Optional shipment status filter.',
      },
    },
  },
};

export const GET_TICKETS_TOOL: ToolDefinition = {
  name: 'get_tickets',
  description: 'Query support tickets for an account with optional filters for ticket_id and status.',
  parameters: {
    type: 'object',
    properties: {
      account_id: {
        type: 'string',
        description: 'The Account ID to fetch tickets for.',
      },
      ticket_id: {
        type: 'string',
        description: 'Optional specific Ticket ID to fetch (e.g. TKT-501).',
      },
      status: {
        type: 'string',
        enum: ['open', 'resolved', 'closed', 'pending'],
        description: 'Optional ticket status filter.',
      },
    },
  },
};

export const SEARCH_DOCS_TOOL: ToolDefinition = {
  name: 'search_docs',
  description: 'Search authoritative policies, SOPs, product guides, known issues, and customer agreements.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query describing the policy question, known issue, or agreement terms.',
      },
      include_deprecated: {
        type: 'boolean',
        description: 'Whether to include deprecated historical policies (default false; only use for historical comparisons).',
      },
    },
    required: ['query'],
  },
};

export const CALC_CANCELLATION_FEE_TOOL: ToolDefinition = {
  name: 'calc_cancellation_fee',
  description: 'Deterministically calculate cancellation eligibility and fee based on order status, booking timestamp, and agreement overrides.',
  parameters: {
    type: 'object',
    properties: {
      order_id: {
        type: 'string',
        description: 'The Order ID to calculate cancellation fee for (e.g. ORD-1001).',
      },
    },
    required: ['order_id'],
  },
};

export const CALC_SERVICE_CREDIT_TOOL: ToolDefinition = {
  name: 'calc_service_credit',
  description: 'Deterministically calculate failed-pickup service credit eligibility, amount, and manager approval requirements.',
  parameters: {
    type: 'object',
    properties: {
      order_id: {
        type: 'string',
        description: 'The Order ID to evaluate service credit eligibility for (e.g. ORD-2002).',
      },
    },
    required: ['order_id'],
  },
};

export const CHECK_SLA_STATUS_TOOL: ToolDefinition = {
  name: 'check_sla_status',
  description: 'Deterministically check SLA response time, target thresholds, and breach status for a ticket.',
  parameters: {
    type: 'object',
    properties: {
      ticket_id: {
        type: 'string',
        description: 'The Ticket ID to check SLA for (e.g. TKT-501).',
      },
    },
    required: ['ticket_id'],
  },
};

export const PROPOSE_ACTION_TOOL: ToolDefinition = {
  name: 'propose_action',
  description: 'Propose a state-changing action (order cancellation, service credit, escalation, ticket update). Generates a draft proposal for user confirmation.',
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['cancellation', 'service_credit', 'escalation', 'ticket_update', 'follow_up_task'],
        description: 'Action type to propose.',
      },
      target_id: {
        type: 'string',
        description: 'Target Order ID, Ticket ID, or Account ID.',
      },
      reason: {
        type: 'string',
        description: 'Reason and policy basis for the proposed action.',
      },
      details: {
        type: 'string',
        description: 'JSON serialized details (e.g. calculated fee, credit amount, escalation severity).',
      },
    },
    required: ['type', 'target_id', 'reason'],
  },
};

export const CONFIRM_ACTION_TOOL: ToolDefinition = {
  name: 'confirm_action',
  description: 'Confirm and execute a previously proposed state-changing action upon explicit user/manager confirmation.',
  parameters: {
    type: 'object',
    properties: {
      action_id: {
        type: 'string',
        description: 'The unique ID of the proposed action to confirm.',
      },
    },
    required: ['action_id'],
  },
};

export const GET_INSIGHTS_TOOL: ToolDefinition = {
  name: 'get_insights',
  description: 'INTERNAL ONLY: Proactively discover topic spikes, SLA breach risks, known issue clusters, and security triage items.',
  parameters: {
    type: 'object',
    properties: {
      query_type: {
        type: 'string',
        enum: ['spike_by_topic', 'sla_at_risk', 'known_issue_correlation', 'security_triage'],
        description: 'Insight query type.',
      },
      params: {
        type: 'string',
        description: 'JSON serialized parameters (e.g. { "min_count": 3, "threshold_pct": 80, "ki_id": "KI-208" }).',
      },
    },
    required: ['query_type'],
  },
};
