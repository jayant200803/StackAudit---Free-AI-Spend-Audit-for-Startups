import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Service-role client — bypasses RLS for admin operations.
 * Only use in API routes (server-side), never in client components.
 */
export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey
);

/**
 * ── ROUND 2 MIGRATION ──
 * Run this in Supabase SQL Editor after the Round 1 migration:
 *
 * ALTER TABLE audits ADD COLUMN IF NOT EXISTS user_email TEXT;
 * ALTER TABLE audits ADD COLUMN IF NOT EXISTS pricing_snapshot JSONB;
 *
 * CREATE TABLE IF NOT EXISTS pricing_overrides (
 *   plan_id TEXT PRIMARY KEY,
 *   tool_id TEXT NOT NULL,
 *   price_per_seat NUMERIC NOT NULL,
 *   updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 * );
 * ALTER TABLE pricing_overrides ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Allow anon read pricing_overrides" ON pricing_overrides FOR SELECT USING (true);
 * CREATE POLICY "Allow service role all pricing_overrides" ON pricing_overrides FOR ALL USING (true);
 *
 * -- Allow service role to update audits (for backfilling user_email)
 * CREATE POLICY "Allow service role update audits" ON audits FOR UPDATE USING (true);
 *
 * ── ROUND 1 SQL (original) ──
 * SQL to run in Supabase SQL Editor to create the required tables:
 *
 * -- Audit results (for shareable URLs)
 * CREATE TABLE audits (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   input JSONB NOT NULL,
 *   recommendations JSONB NOT NULL,
 *   total_current_spend NUMERIC NOT NULL,
 *   total_optimized_spend NUMERIC NOT NULL,
 *   total_monthly_savings NUMERIC NOT NULL,
 *   total_annual_savings NUMERIC NOT NULL,
 *   credex_savings_estimate NUMERIC NOT NULL DEFAULT 0,
 *   ai_summary TEXT NOT NULL DEFAULT '',
 *   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 * );
 *
 * -- Leads
 * CREATE TABLE leads (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   email TEXT NOT NULL,
 *   company_name TEXT,
 *   role TEXT,
 *   team_size INTEGER,
 *   audit_id UUID REFERENCES audits(id),
 *   total_monthly_savings NUMERIC NOT NULL DEFAULT 0,
 *   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 * );
 *
 * -- Rate limiting: simple IP-based counter
 * CREATE TABLE rate_limits (
 *   ip TEXT PRIMARY KEY,
 *   count INTEGER NOT NULL DEFAULT 1,
 *   window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
 * );
 *
 * -- RLS policies (enable RLS on all tables)
 * ALTER TABLE audits ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
 *
 * -- Allow anon inserts/selects for audits
 * CREATE POLICY "Allow anon insert audits" ON audits FOR INSERT WITH CHECK (true);
 * CREATE POLICY "Allow anon select audits" ON audits FOR SELECT USING (true);
 *
 * -- Allow anon inserts for leads
 * CREATE POLICY "Allow anon insert leads" ON leads FOR INSERT WITH CHECK (true);
 *
 * -- Rate limits: allow anon operations
 * CREATE POLICY "Allow anon ops rate_limits" ON rate_limits FOR ALL USING (true);
 */
