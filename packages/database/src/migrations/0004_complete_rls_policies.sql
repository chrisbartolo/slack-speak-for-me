-- Migration: Add RLS policies to remaining workspace-scoped tables
-- Tables: installations, report_settings, google_integrations, workflow_config

-- ============================================
-- INSTALLATIONS TABLE
-- Contains encrypted OAuth tokens - critical for security
-- ============================================
ALTER TABLE "installations" ENABLE ROW LEVEL SECURITY;

-- RLS policy for tenant isolation
DO $$ BEGIN
  CREATE POLICY "tenant_isolation" ON "installations"
    USING (workspace_id = current_setting('app.current_workspace_id', true)::uuid);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- REPORT_SETTINGS TABLE
-- User report scheduling preferences
-- ============================================
ALTER TABLE "report_settings" ENABLE ROW LEVEL SECURITY;

-- RLS policy for tenant isolation
DO $$ BEGIN
  CREATE POLICY "tenant_isolation" ON "report_settings"
    USING (workspace_id = current_setting('app.current_workspace_id', true)::uuid);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- GOOGLE_INTEGRATIONS TABLE
-- Contains encrypted Google OAuth tokens - critical for security
-- ============================================
ALTER TABLE "google_integrations" ENABLE ROW LEVEL SECURITY;

-- RLS policy for tenant isolation
DO $$ BEGIN
  CREATE POLICY "tenant_isolation" ON "google_integrations"
    USING (workspace_id = current_setting('app.current_workspace_id', true)::uuid);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- WORKFLOW_CONFIG TABLE
-- User workflow channel configurations
-- ============================================
ALTER TABLE "workflow_config" ENABLE ROW LEVEL SECURITY;

-- RLS policy for tenant isolation
DO $$ BEGIN
  CREATE POLICY "tenant_isolation" ON "workflow_config"
    USING (workspace_id = current_setting('app.current_workspace_id', true)::uuid);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
