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
  CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id TEXT NOT NULL UNIQUE,
    enterprise_id TEXT,
    name TEXT,
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
    created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE INDEX users_workspace_id_idx ON users(workspace_id);
  CREATE INDEX users_slack_user_id_idx ON users(slack_user_id);

  CREATE TABLE watched_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    user_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    watched_at TIMESTAMP DEFAULT NOW()
  );
  CREATE INDEX watched_conversations_workspace_user_idx ON watched_conversations(workspace_id, user_id);
  CREATE UNIQUE INDEX watched_conversations_unique_watch_idx ON watched_conversations(workspace_id, user_id, channel_id);

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
    TRUNCATE TABLE workflow_config CASCADE;
    TRUNCATE TABLE google_integrations CASCADE;
    TRUNCATE TABLE report_settings CASCADE;
    TRUNCATE TABLE person_context CASCADE;
    TRUNCATE TABLE gdpr_consent CASCADE;
    TRUNCATE TABLE refinement_feedback CASCADE;
    TRUNCATE TABLE message_embeddings CASCADE;
    TRUNCATE TABLE user_style_preferences CASCADE;
    TRUNCATE TABLE thread_participants CASCADE;
    TRUNCATE TABLE watched_conversations CASCADE;
    TRUNCATE TABLE users CASCADE;
    TRUNCATE TABLE installations CASCADE;
    TRUNCATE TABLE workspaces CASCADE;
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
