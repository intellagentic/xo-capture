-- ============================================================
-- XO CAPTURE - PostgreSQL Schema
-- Database: xo_quickstart
-- Engine: PostgreSQL 15 on RDS (db.t3.micro)
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS TABLE
-- Authentication and user management
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================================
-- CLIENTS TABLE
-- Domain partner information (replaces metadata.json in S3)
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    website_url VARCHAR(500),
    contact_name VARCHAR(255),
    contact_title VARCHAR(255),
    contact_linkedin VARCHAR(500),
    industry VARCHAR(255),
    description TEXT,
    pain_point TEXT,
    survival_metric_1 TEXT,
    survival_metric_2 TEXT,
    ai_persona TEXT,
    strategic_objective TEXT,
    tone_mode VARCHAR(50),
    s3_folder VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_s3_folder ON clients(s3_folder);

-- ============================================================
-- UPLOADS TABLE
-- Tracks individual file uploads per client
-- ============================================================
CREATE TABLE IF NOT EXISTS uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    filename VARCHAR(500) NOT NULL,
    file_type VARCHAR(100),
    s3_key VARCHAR(1000) NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uploads_client_id ON uploads(client_id);

-- ============================================================
-- ENRICHMENTS TABLE
-- Tracks enrichment job runs and results
-- ============================================================
CREATE TABLE IF NOT EXISTS enrichments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'processing',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    results_s3_key VARCHAR(1000)
);

CREATE INDEX IF NOT EXISTS idx_enrichments_client_id ON enrichments(client_id);

-- ============================================================
-- SKILLS TABLE
-- Domain-specific skills injected into Claude prompts
-- ============================================================
CREATE TABLE IF NOT EXISTS skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    content TEXT,
    s3_key VARCHAR(1000),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skills_client_id ON skills(client_id);

-- ============================================================
-- BUTTONS TABLE
-- User-configurable action buttons (replaces localStorage)
-- ============================================================
CREATE TABLE IF NOT EXISTS buttons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    icon VARCHAR(50) DEFAULT 'Zap',
    color VARCHAR(20) DEFAULT '#3b82f6',
    url VARCHAR(500),
    sort_order INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_buttons_user_id ON buttons(user_id);
ALTER TABLE buttons ADD COLUMN IF NOT EXISTS show_on TEXT DEFAULT '["welcome"]';

-- ============================================================
-- GOOGLE DRIVE INTEGRATION (migration)
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_drive_refresh_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_drive_connected_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual';
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_model VARCHAR(100) DEFAULT 'claude-sonnet-4-5-20250929';

-- ============================================================
-- ENRICHMENT STAGE TRACKING (migration)
-- Values: extracting, transcribing, researching, analyzing, complete, error
-- ============================================================
ALTER TABLE enrichments ADD COLUMN IF NOT EXISTS stage VARCHAR(50) DEFAULT 'extracting';

-- ============================================================
-- SOURCE LIBRARY (migration)
-- Adds file management columns for toggle, replace, delete
-- ============================================================
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS parent_upload_id UUID REFERENCES uploads(id) ON DELETE SET NULL;
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS replaced_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_uploads_status ON uploads(status);
CREATE INDEX IF NOT EXISTS idx_uploads_parent ON uploads(parent_upload_id);

-- ============================================================
-- CLIENT BRANDING (migration)
-- Logo and icon S3 keys for client visual identity
-- ============================================================
ALTER TABLE clients ADD COLUMN IF NOT EXISTS logo_s3_key VARCHAR(500);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS icon_s3_key VARCHAR(500);

-- ============================================================
-- STREAMLINE WEBHOOK TOGGLE (migration)
-- Per-client toggle to auto-send enrichment results to Streamline
-- ============================================================
ALTER TABLE clients ADD COLUMN IF NOT EXISTS streamline_webhook_enabled BOOLEAN DEFAULT FALSE;

-- ============================================================
-- CONTACT EMAIL & PHONE (migration)
-- Direct contact details for client primary contact
-- ============================================================
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_email VARCHAR(500);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(100);

-- ============================================================
-- MULTI-CONTACT SUPPORT (migration)
-- JSON array of contacts; first element = primary contact
-- Legacy contact_* columns synced from contacts[0] on every write
-- ============================================================
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contacts_json TEXT;

-- ============================================================
-- MULTI-ADDRESS SUPPORT (migration)
-- JSON array of addresses; first element = primary address
-- Each: {label, address1, address2, city, state, postalCode, country}
-- ============================================================
ALTER TABLE clients ADD COLUMN IF NOT EXISTS addresses_json TEXT;

-- ============================================================
-- PER-CLIENT WEBHOOK URL (migration)
-- Overrides STREAMLINE_WEBHOOK_URL env var when set
-- ============================================================
ALTER TABLE clients ADD COLUMN IF NOT EXISTS streamline_webhook_url VARCHAR(1000);

-- ============================================================
-- SYSTEM SKILLS (migration)
-- Make client_id nullable so system skills (client_id IS NULL) are global
-- ============================================================
ALTER TABLE skills ALTER COLUMN client_id DROP NOT NULL;

-- ============================================================
-- SYSTEM BUTTONS (migration)
-- Add client_id for client-specific buttons; NULL = system button
-- Make user_id nullable (system buttons have no owner user)
-- ============================================================
ALTER TABLE buttons ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE buttons ALTER COLUMN user_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_buttons_client_id ON buttons(client_id);

-- ============================================================
-- HUBSPOT SYNC (migration)
-- Bi-directional sync tracking between XO Capture and HubSpot CRM
-- ============================================================
ALTER TABLE clients ADD COLUMN IF NOT EXISTS hubspot_company_id VARCHAR(50);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS hubspot_contact_id VARCHAR(50);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS hubspot_last_sync TIMESTAMP;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS hubspot_last_enrichment_id VARCHAR(50);

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS hubspot_company_id VARCHAR(50);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS hubspot_last_sync TIMESTAMP;

-- system_config entries used by hubspot-sync Lambda:
--   hubspot_access_token (encrypted)
--   hubspot_refresh_token (encrypted)
--   hubspot_token_expiry
--   hubspot_last_full_sync
--   hubspot_intellagentic_company_id (HubSpot ID for Intellagentic master Company)

-- ============================================================
-- HUBSPOT SYNC LOG (migration)
-- Tracks every sync action and conflicts for review
-- ============================================================
CREATE TABLE IF NOT EXISTS hubspot_sync_log (
    id SERIAL PRIMARY KEY,
    record_type VARCHAR(20) NOT NULL,
    record_id UUID,
    hubspot_id VARCHAR(50),
    sync_direction VARCHAR(10) NOT NULL,
    fields_updated TEXT,
    fields_skipped TEXT,
    details TEXT,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hubspot_sync_log_direction ON hubspot_sync_log(sync_direction);
CREATE INDEX IF NOT EXISTS idx_hubspot_sync_log_record ON hubspot_sync_log(record_type, record_id);

-- Approval flow
ALTER TABLE clients ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS approved_by TEXT;

-- Company LinkedIn
ALTER TABLE clients ADD COLUMN IF NOT EXISTS company_linkedin TEXT;

-- Engagements
CREATE TABLE IF NOT EXISTS engagements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    focus_area TEXT,
    contacts_json TEXT,
    status VARCHAR(50) DEFAULT 'active',
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    hubspot_deal_id VARCHAR(50)
);
CREATE INDEX IF NOT EXISTS idx_engagements_client_id ON engagements(client_id);
CREATE INDEX IF NOT EXISTS idx_engagements_status ON engagements(status);
ALTER TABLE enrichments ADD COLUMN IF NOT EXISTS engagement_id UUID;
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS hubspot_note_id TEXT;
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS hubspot_synced_at TIMESTAMP;

-- Multi-tenant auth
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_role TEXT CHECK (account_role IN ('super_admin', 'account_admin', 'account_user', 'client_contact', 'contributor'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('invited', 'active', 'deactivated'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS user_client_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES users(id),
    assigned_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, client_id)
);
CREATE INDEX IF NOT EXISTS idx_uca_user_id ON user_client_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_uca_client_id ON user_client_assignments(client_id);

-- Workflow builds tracking
CREATE TABLE IF NOT EXISTS workflow_builds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id),
    engagement_id UUID REFERENCES engagements(id),
    app_index INTEGER,
    app_title TEXT,
    streamline_project_id TEXT,
    streamline_project_url TEXT,
    status TEXT DEFAULT 'building',
    steps_json TEXT,
    needs_ui_config TEXT,
    error TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);
