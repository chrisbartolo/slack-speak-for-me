/**
 * PGlite database helpers for integration tests
 *
 * Provides in-memory PostgreSQL for isolated test execution.
 * Schema matches production database structure.
 */

import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@slack-speak/database';

let pgLite: PGlite | null = null;
let testDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * SQL schema for test database
 * Mirrors production schema from packages/database/src/schema.ts
 * Note: PGlite uses gen_random_uuid() for UUID generation (no extension needed)
 */
const createTablesSQL = `
  CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    subscription_status TEXT,
    plan_id TEXT,
    seat_count INTEGER DEFAULT 1,
    trial_ends_at TIMESTAMP,
    billing_email TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
  CREATE UNIQUE INDEX organizations_slug_idx ON organizations(slug);
  CREATE INDEX organizations_stripe_customer_idx ON organizations(stripe_customer_id);

  CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id TEXT NOT NULL UNIQUE,
    enterprise_id TEXT,
    name TEXT,
    organization_id UUID REFERENCES organizations(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    bot_token TEXT NOT NULL,
    bot_user_id TEXT,
    bot_scopes TEXT,
    user_token TEXT,
    user_id TEXT,
    user_scopes TEXT,
    installed_at TIMESTAMP DEFAULT NOW()
  );
  CREATE UNIQUE INDEX installations_workspace_id_unique ON installations(workspace_id);

  CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    slack_user_id TEXT NOT NULL,
    email TEXT,
    role TEXT DEFAULT 'member',
    created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE INDEX users_workspace_id_idx ON users(workspace_id);
  CREATE INDEX users_slack_user_id_idx ON users(slack_user_id);
  CREATE INDEX users_role_idx ON users(role);

  CREATE TABLE watched_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    user_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    channel_name TEXT,
    channel_type TEXT,
    auto_respond BOOLEAN DEFAULT false,
    watched_at TIMESTAMP DEFAULT NOW()
  );
  CREATE INDEX watched_conversations_workspace_user_idx ON watched_conversations(workspace_id, user_id);
  CREATE UNIQUE INDEX watched_conversations_unique_watch_idx ON watched_conversations(workspace_id, user_id, channel_id);

  CREATE TABLE auto_respond_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    user_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    thread_ts TEXT,
    trigger_message_ts TEXT NOT NULL,
    trigger_message_text TEXT,
    response_text TEXT NOT NULL,
    response_message_ts TEXT,
    status TEXT DEFAULT 'sent',
    sent_at TIMESTAMP DEFAULT NOW(),
    undone_at TIMESTAMP
  );
  CREATE INDEX auto_respond_log_workspace_user_idx ON auto_respond_log(workspace_id, user_id);
  CREATE INDEX auto_respond_log_channel_idx ON auto_respond_log(channel_id);
  CREATE INDEX auto_respond_log_sent_at_idx ON auto_respond_log(sent_at);

  CREATE TABLE thread_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    user_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    thread_ts TEXT NOT NULL,
    last_message_at TIMESTAMP DEFAULT NOW()
  );
  CREATE INDEX thread_participants_workspace_channel_thread_idx ON thread_participants(workspace_id, channel_id, thread_ts);
  CREATE UNIQUE INDEX thread_participants_unique_participation_idx ON thread_participants(workspace_id, user_id, channel_id, thread_ts);

  CREATE TABLE user_style_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    user_id TEXT NOT NULL,
    tone TEXT,
    formality TEXT,
    preferred_phrases JSONB DEFAULT '[]',
    avoid_phrases JSONB DEFAULT '[]',
    custom_guidance TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
  );
  CREATE UNIQUE INDEX user_style_preferences_workspace_user_idx ON user_style_preferences(workspace_id, user_id);

  CREATE TABLE message_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    user_id TEXT NOT NULL,
    message_text TEXT NOT NULL,
    thread_context TEXT,
    embedding TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE INDEX message_embeddings_workspace_user_idx ON message_embeddings(workspace_id, user_id);
  CREATE INDEX message_embeddings_created_at_idx ON message_embeddings(created_at);

  CREATE TABLE refinement_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    user_id TEXT NOT NULL,
    suggestion_id TEXT NOT NULL,
    original_text TEXT NOT NULL,
    modified_text TEXT NOT NULL,
    refinement_type TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE INDEX refinement_feedback_workspace_user_idx ON refinement_feedback(workspace_id, user_id);

  CREATE TABLE gdpr_consent (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    user_id TEXT NOT NULL,
    consent_type TEXT NOT NULL,
    consented_at TIMESTAMP,
    revoked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE INDEX gdpr_consent_workspace_id_idx ON gdpr_consent(workspace_id);
  CREATE UNIQUE INDEX gdpr_consent_unique_idx ON gdpr_consent(workspace_id, user_id, consent_type);

  CREATE TABLE person_context (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    user_id TEXT NOT NULL,
    target_slack_user_id TEXT NOT NULL,
    target_user_name TEXT,
    context_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
  CREATE INDEX person_context_workspace_user_idx ON person_context(workspace_id, user_id);
  CREATE UNIQUE INDEX person_context_unique_idx ON person_context(workspace_id, user_id, target_slack_user_id);

  CREATE TABLE conversation_context (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    user_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    channel_name TEXT,
    channel_type TEXT,
    context_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
  CREATE INDEX conversation_context_workspace_user_idx ON conversation_context(workspace_id, user_id);
  CREATE UNIQUE INDEX conversation_context_unique_idx ON conversation_context(workspace_id, user_id, channel_id);

  CREATE TABLE report_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    user_id TEXT NOT NULL,
    enabled BOOLEAN DEFAULT false,
    day_of_week INTEGER DEFAULT 1,
    time_of_day TEXT DEFAULT '09:00',
    timezone TEXT DEFAULT 'UTC',
    format TEXT DEFAULT 'detailed',
    sections JSONB DEFAULT '["achievements", "focus", "blockers", "shoutouts"]',
    auto_send BOOLEAN DEFAULT false,
    recipient_channel_id TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
  CREATE UNIQUE INDEX report_settings_unique_idx ON report_settings(workspace_id, user_id);

  CREATE TABLE google_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    user_id TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMP,
    scope TEXT,
    spreadsheet_id TEXT,
    spreadsheet_name TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
  CREATE UNIQUE INDEX google_integrations_unique_idx ON google_integrations(workspace_id, user_id);

  CREATE TABLE workflow_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    user_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    channel_name TEXT,
    workflow_bot_id TEXT,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
  CREATE UNIQUE INDEX workflow_config_unique_idx ON workflow_config(workspace_id, user_id, channel_id);
  CREATE INDEX workflow_config_channel_idx ON workflow_config(workspace_id, channel_id);

  CREATE TABLE suggestion_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    user_id TEXT NOT NULL,
    suggestion_id TEXT NOT NULL,
    action TEXT NOT NULL,
    original_text TEXT,
    final_text TEXT,
    trigger_context TEXT,
    channel_id TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE INDEX suggestion_feedback_workspace_user_idx ON suggestion_feedback(workspace_id, user_id);
  CREATE INDEX suggestion_feedback_created_at_idx ON suggestion_feedback(created_at);
  CREATE INDEX suggestion_feedback_action_idx ON suggestion_feedback(action);
  CREATE UNIQUE INDEX suggestion_feedback_suggestion_idx ON suggestion_feedback(suggestion_id, action);

  CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    workspace_id UUID REFERENCES workspaces(id),
    ip_address TEXT,
    user_agent TEXT,
    action TEXT NOT NULL,
    resource TEXT,
    resource_id TEXT,
    details JSONB,
    previous_value JSONB,
    new_value JSONB,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
  );
  CREATE INDEX audit_logs_workspace_idx ON audit_logs(workspace_id);
  CREATE INDEX audit_logs_user_idx ON audit_logs(user_id);
  CREATE INDEX audit_logs_action_idx ON audit_logs(action);
  CREATE INDEX audit_logs_created_at_idx ON audit_logs(created_at);

  CREATE TABLE user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    subscription_status TEXT,
    plan_id TEXT,
    trial_ends_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
  CREATE UNIQUE INDEX user_subscriptions_email_idx ON user_subscriptions(email);
  CREATE INDEX user_subscriptions_stripe_customer_idx ON user_subscriptions(stripe_customer_id);

  CREATE TABLE usage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT,
    organization_id UUID REFERENCES organizations(id),
    billing_period_start TIMESTAMP NOT NULL,
    billing_period_end TIMESTAMP NOT NULL,
    suggestions_used INTEGER DEFAULT 0 NOT NULL,
    suggestions_included INTEGER NOT NULL,
    overage_reported BOOLEAN DEFAULT false,
    stripe_subscription_item_id TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
  CREATE UNIQUE INDEX usage_records_email_period_idx ON usage_records(email, billing_period_start);
  CREATE UNIQUE INDEX usage_records_org_period_idx ON usage_records(organization_id, billing_period_start);
  CREATE INDEX usage_records_period_end_idx ON usage_records(billing_period_end);

  CREATE TABLE usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT,
    organization_id UUID REFERENCES organizations(id),
    slack_user_id TEXT NOT NULL,
    workspace_id UUID REFERENCES workspaces(id),
    event_type TEXT NOT NULL,
    channel_id TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    estimated_cost INTEGER,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
  );
  CREATE INDEX usage_events_email_idx ON usage_events(email);
  CREATE INDEX usage_events_org_idx ON usage_events(organization_id);
  CREATE INDEX usage_events_created_at_idx ON usage_events(created_at);
  CREATE INDEX usage_events_type_idx ON usage_events(event_type);

  CREATE TABLE coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL,
    description TEXT,
    discount_type TEXT NOT NULL,
    discount_value INTEGER NOT NULL,
    valid_from TIMESTAMP DEFAULT NOW(),
    valid_until TIMESTAMP,
    max_redemptions INTEGER,
    current_redemptions INTEGER DEFAULT 0,
    applicable_plans JSONB,
    first_time_only BOOLEAN DEFAULT true,
    min_seats INTEGER,
    stripe_coupon_id TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
  CREATE UNIQUE INDEX coupons_code_idx ON coupons(code);
  CREATE INDEX coupons_active_idx ON coupons(is_active);

  CREATE TABLE coupon_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID NOT NULL REFERENCES coupons(id),
    email TEXT NOT NULL,
    organization_id UUID REFERENCES organizations(id),
    discount_applied INTEGER NOT NULL,
    redeemed_at TIMESTAMP DEFAULT NOW()
  );
  CREATE INDEX coupon_redemptions_coupon_idx ON coupon_redemptions(coupon_id);
  CREATE INDEX coupon_redemptions_email_idx ON coupon_redemptions(email);

  CREATE TABLE referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_email TEXT NOT NULL,
    referral_code TEXT NOT NULL,
    total_referrals INTEGER DEFAULT 0,
    successful_referrals INTEGER DEFAULT 0,
    total_rewards_earned INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
  CREATE UNIQUE INDEX referrals_referrer_idx ON referrals(referrer_email);
  CREATE UNIQUE INDEX referrals_code_idx ON referrals(referral_code);

  CREATE TABLE referral_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referral_id UUID NOT NULL REFERENCES referrals(id),
    referee_email TEXT NOT NULL,
    status TEXT NOT NULL,
    referrer_reward INTEGER,
    referee_discount INTEGER,
    signed_up_at TIMESTAMP,
    subscribed_at TIMESTAMP,
    rewarded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE INDEX referral_events_referral_idx ON referral_events(referral_id);
  CREATE UNIQUE INDEX referral_events_referee_idx ON referral_events(referee_email);
  CREATE INDEX referral_events_status_idx ON referral_events(status);
`;

/**
 * Initialize a fresh PGlite instance with schema
 * Call this in beforeAll or beforeEach depending on isolation needs
 */
export async function setupTestDb() {
  // Clean up any existing instance
  if (pgLite) {
    await pgLite.close();
  }

  pgLite = new PGlite();
  testDb = drizzle(pgLite, { schema });

  // Create tables
  await pgLite.exec(createTablesSQL);

  return testDb;
}

/**
 * Clean up PGlite instance
 * Call this in afterAll to release resources
 */
export async function cleanupTestDb() {
  if (pgLite) {
    await pgLite.close();
    pgLite = null;
    testDb = null;
  }
}

/**
 * Get the current test database instance
 * Throws if not initialized
 */
export function getTestDb() {
  if (!testDb) {
    throw new Error('Test DB not initialized. Call setupTestDb() first.');
  }
  return testDb;
}

/**
 * Get the raw PGlite instance for direct SQL execution
 * Useful for verifying data or complex queries
 */
export function getPGlite() {
  if (!pgLite) {
    throw new Error('PGlite not initialized. Call setupTestDb() first.');
  }
  return pgLite;
}

/**
 * Clear all tables while keeping schema
 * Useful for resetting state between tests within same suite
 */
export async function clearAllTables() {
  if (!pgLite) {
    throw new Error('PGlite not initialized. Call setupTestDb() first.');
  }

  await pgLite.exec(`
    TRUNCATE TABLE referral_events CASCADE;
    TRUNCATE TABLE referrals CASCADE;
    TRUNCATE TABLE coupon_redemptions CASCADE;
    TRUNCATE TABLE coupons CASCADE;
    TRUNCATE TABLE usage_events CASCADE;
    TRUNCATE TABLE usage_records CASCADE;
    TRUNCATE TABLE user_subscriptions CASCADE;
    TRUNCATE TABLE audit_logs CASCADE;
    TRUNCATE TABLE suggestion_feedback CASCADE;
    TRUNCATE TABLE workflow_config CASCADE;
    TRUNCATE TABLE google_integrations CASCADE;
    TRUNCATE TABLE report_settings CASCADE;
    TRUNCATE TABLE conversation_context CASCADE;
    TRUNCATE TABLE person_context CASCADE;
    TRUNCATE TABLE gdpr_consent CASCADE;
    TRUNCATE TABLE refinement_feedback CASCADE;
    TRUNCATE TABLE message_embeddings CASCADE;
    TRUNCATE TABLE user_style_preferences CASCADE;
    TRUNCATE TABLE thread_participants CASCADE;
    TRUNCATE TABLE auto_respond_log CASCADE;
    TRUNCATE TABLE watched_conversations CASCADE;
    TRUNCATE TABLE users CASCADE;
    TRUNCATE TABLE installations CASCADE;
    TRUNCATE TABLE workspaces CASCADE;
    TRUNCATE TABLE organizations CASCADE;
  `);
}

/**
 * Seed a workspace with installation for testing
 * Returns the created workspace ID
 */
export async function seedWorkspace(options: {
  teamId?: string;
  name?: string;
  botToken?: string;
  botUserId?: string;
} = {}) {
  if (!pgLite) {
    throw new Error('PGlite not initialized. Call setupTestDb() first.');
  }

  const teamId = options.teamId ?? 'T123';
  const name = options.name ?? 'Test Workspace';
  const botToken = options.botToken ?? 'xoxb-test-token';
  const botUserId = options.botUserId ?? 'B123';

  const result = await pgLite.query<{ id: string }>(`
    WITH new_workspace AS (
      INSERT INTO workspaces (team_id, name)
      VALUES ($1, $2)
      RETURNING id
    )
    INSERT INTO installations (workspace_id, bot_token, bot_user_id, bot_scopes)
    SELECT id, $3, $4, 'channels:history,chat:write,commands,users:read'
    FROM new_workspace
    RETURNING workspace_id as id
  `, [teamId, name, botToken, botUserId]);

  return result.rows[0].id;
}

/**
 * Seed a user subscription for testing billing
 */
export async function seedUserSubscription(options: {
  email: string;
  planId?: string;
  status?: string;
  stripeCustomerId?: string;
}) {
  if (!pgLite) {
    throw new Error('PGlite not initialized. Call setupTestDb() first.');
  }

  const result = await pgLite.query<{ id: string }>(`
    INSERT INTO user_subscriptions (email, plan_id, subscription_status, stripe_customer_id)
    VALUES ($1, $2, $3, $4)
    RETURNING id
  `, [
    options.email,
    options.planId ?? 'starter',
    options.status ?? 'active',
    options.stripeCustomerId ?? null,
  ]);

  return result.rows[0].id;
}

/**
 * Seed a referral for testing
 */
export async function seedReferral(options: {
  referrerEmail: string;
  referralCode: string;
}) {
  if (!pgLite) {
    throw new Error('PGlite not initialized. Call setupTestDb() first.');
  }

  const result = await pgLite.query<{ id: string }>(`
    INSERT INTO referrals (referrer_email, referral_code)
    VALUES ($1, $2)
    RETURNING id
  `, [options.referrerEmail, options.referralCode]);

  return result.rows[0].id;
}
