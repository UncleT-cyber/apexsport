-- APEXSPORT — Supabase PostgreSQL schema
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

-- ─── USERS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('ADMIN', 'USER')),
  status TEXT NOT NULL DEFAULT 'INVITED' CHECK (status IN ('INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED')),
  password_hash TEXT,
  mfa_secret TEXT,
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  invited_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- ─── RESET TOKENS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reset_tokens (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

-- ─── SLIPS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS slips (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TEXT NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slips_created ON slips (created_at DESC);

-- ─── SETTINGS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TEXT NOT NULL DEFAULT now()
);

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────────────────────
-- Enable RLS but allow service_role key full access (backend uses service_role)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE slips ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS, but create policies for anon key if needed
CREATE POLICY "Service role full access" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON reset_tokens FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON slips FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON app_settings FOR ALL USING (true) WITH CHECK (true);
