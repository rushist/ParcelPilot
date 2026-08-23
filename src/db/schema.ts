export interface AccountRecord {
  account_id: string;
  account_name: string;
  plan: 'Standard' | 'Growth' | 'Enterprise';
  status: 'active' | 'suspended';
  csm?: string | null;
  contract_file?: string | null;
  premium_support: boolean;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface OrderRecord {
  order_id: string;
  account_id: string;
  carrier: 'SwiftShip' | 'RoadRunner' | 'BlueDart Pro' | string;
  status: 'DRAFT' | 'BOOKED' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED' | string;
  booked_at?: string | null;
  pickup_window_start?: string | null;
  pickup_window_end?: string | null;
  pickup_actual_at?: string | null;
  shipment_fee_inr: number;
  carrier_fault: boolean;
  customer_fault: boolean;
  cancellation_requested_at?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TicketRecord {
  ticket_id: string;
  account_id: string;
  created_at: string;
  status: 'open' | 'resolved' | 'closed' | 'pending' | string;
  priority?: 'P1' | 'P2' | 'P3' | 'CRITICAL' | string;
  subject: string;
  description: string;
  channel?: 'email' | 'chat' | 'phone' | 'portal' | string | null;
  assigned_to?: string | null;
  last_customer_message_at?: string | null;
  historical_resolution?: string | null;
  updated_at?: string;
}

export interface DocChunkRecord {
  id: string;
  doc_id: string;
  doc_status: 'CURRENT' | 'DEPRECATED';
  doc_type: 'policy' | 'sop' | 'guide' | 'agreement';
  effective_date?: string | null;
  account_id?: string | null;
  section: string;
  title?: string | null;
  authority_rank: number; // 1: Signed Agreement, 2: Current Policy/SOP, 3: Product Guide/Known Issues, 4: Context
  text: string;
  created_at?: string;
}

export interface ActionRecord {
  id: string;
  type: 'cancellation' | 'service_credit' | 'escalation' | 'ticket_update' | 'follow_up_task';
  payload: Record<string, any>;
  status: 'PROPOSED' | 'CONFIRMED' | 'REJECTED' | 'EXECUTED';
  account_id: string;
  created_at?: string;
  created_by: string;
  confirmed_at?: string | null;
  confirmed_by?: string | null;
  notes?: string | null;
}

export interface AuditLogRecord {
  id: string;
  actor: string;
  action: string;
  account_id?: string | null;
  payload?: Record<string, any> | null;
  created_at?: string;
}
