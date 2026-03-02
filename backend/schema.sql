-- ============================================================
-- XO QUICKSTART - PostgreSQL Schema
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
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
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

-- ============================================================
-- GOOGLE DRIVE INTEGRATION (migration)
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_drive_refresh_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_drive_connected_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual';
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_model VARCHAR(100) DEFAULT 'claude-opus-4-5-20250529';
