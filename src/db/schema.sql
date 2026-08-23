-- ============================================================================
-- ParcelPilot PostgreSQL Schema Migration
-- ============================================================================

-- Drop existing tables in reverse dependency order (if exists)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS actions CASCADE;
DROP TABLE IF EXISTS doc_chunks CASCADE;
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;

-- 1. ACCOUNTS TABLE
CREATE TABLE accounts (
    account_id VARCHAR(50) PRIMARY KEY,
    account_name VARCHAR(255) NOT NULL,
    plan VARCHAR(50) NOT NULL, -- e.g., 'Standard', 'Growth', 'Enterprise'
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'suspended'
    csm VARCHAR(255),
    contract_file VARCHAR(255),
    premium_support BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_accounts_status ON accounts(status);
CREATE INDEX idx_accounts_plan ON accounts(plan);
CREATE INDEX idx_accounts_name ON accounts(account_name);

-- 2. ORDERS TABLE
CREATE TABLE orders (
    order_id VARCHAR(50) PRIMARY KEY,
    account_id VARCHAR(50) NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    carrier VARCHAR(100) NOT NULL, -- 'SwiftShip', 'RoadRunner', 'BlueDart Pro'
    status VARCHAR(50) NOT NULL, -- 'DRAFT', 'BOOKED', 'PICKED_UP', 'DELIVERED', 'CANCELLED'
    booked_at TIMESTAMP WITH TIME ZONE,
    pickup_window_start TIMESTAMP WITH TIME ZONE,
    pickup_window_end TIMESTAMP WITH TIME ZONE,
    pickup_actual_at TIMESTAMP WITH TIME ZONE,
    shipment_fee_inr NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    carrier_fault BOOLEAN NOT NULL DEFAULT FALSE,
    customer_fault BOOLEAN NOT NULL DEFAULT FALSE,
    cancellation_requested_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_account_id ON orders(account_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_carrier ON orders(carrier);
CREATE INDEX idx_orders_booked_at ON orders(booked_at);

-- 3. TICKETS TABLE
CREATE TABLE tickets (
    ticket_id VARCHAR(50) PRIMARY KEY,
    account_id VARCHAR(50) NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'open', -- 'open', 'resolved', 'closed', 'pending'
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    channel VARCHAR(50), -- 'email', 'chat', 'phone', 'portal'
    assigned_to VARCHAR(100),
    last_customer_message_at TIMESTAMP WITH TIME ZONE,
    historical_resolution TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tickets_account_id ON tickets(account_id);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_created_at ON tickets(created_at);
CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to);

-- 4. DOCUMENT CHUNKS TABLE (Hybrid Search & Authoritative Text)
CREATE TABLE doc_chunks (
    id VARCHAR(100) PRIMARY KEY,
    doc_id VARCHAR(100) NOT NULL,
    doc_status VARCHAR(50) NOT NULL, -- 'CURRENT', 'DEPRECATED'
    doc_type VARCHAR(50) NOT NULL, -- 'policy', 'sop', 'guide', 'agreement'
    effective_date DATE,
    account_id VARCHAR(50) REFERENCES accounts(account_id) ON DELETE SET NULL, -- NULL for general, ACCT-001 / ACCT-002 for custom agreements
    section VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    authority_rank INTEGER NOT NULL DEFAULT 2, -- 1: Agreement, 2: Current Policy/SOP, 3: Product Guide/Known Issues, 4: Context
    text TEXT NOT NULL,
    tsv TSVECTOR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_doc_chunks_doc_id ON doc_chunks(doc_id);
CREATE INDEX idx_doc_chunks_doc_status ON doc_chunks(doc_status);
CREATE INDEX idx_doc_chunks_doc_type ON doc_chunks(doc_type);
CREATE INDEX idx_doc_chunks_account_id ON doc_chunks(account_id);
CREATE INDEX idx_doc_chunks_authority ON doc_chunks(authority_rank);
CREATE INDEX idx_doc_chunks_tsv ON doc_chunks USING GIN(tsv);

-- Trigger for full-text search vector update
CREATE OR REPLACE FUNCTION doc_chunks_tsv_trigger() RETURNS trigger AS $$
BEGIN
    new.tsv := setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
               setweight(to_tsvector('english', coalesce(new.section, '')), 'B') ||
               setweight(to_tsvector('english', coalesce(new.text, '')), 'C');
    return new;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_doc_chunks_tsv
BEFORE INSERT OR UPDATE ON doc_chunks
FOR EACH ROW EXECUTE FUNCTION doc_chunks_tsv_trigger();

-- 5. ACTIONS TABLE (Two-Phase State-Changing Proposals)
CREATE TABLE actions (
    id VARCHAR(100) PRIMARY KEY,
    type VARCHAR(50) NOT NULL, -- 'cancellation', 'service_credit', 'escalation', 'ticket_update', 'follow_up_task'
    payload JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PROPOSED', -- 'PROPOSED', 'CONFIRMED', 'REJECTED', 'EXECUTED'
    account_id VARCHAR(50) NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100) NOT NULL,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    confirmed_by VARCHAR(100),
    notes TEXT
);

CREATE INDEX idx_actions_account_id ON actions(account_id);
CREATE INDEX idx_actions_status ON actions(status);
CREATE INDEX idx_actions_type ON actions(type);
CREATE INDEX idx_actions_created_at ON actions(created_at);

-- 6. AUDIT LOGS TABLE
CREATE TABLE audit_logs (
    id VARCHAR(100) PRIMARY KEY,
    actor VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    account_id VARCHAR(50) REFERENCES accounts(account_id) ON DELETE SET NULL,
    payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_actor ON audit_logs(actor);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_account_id ON audit_logs(account_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
