/**
 * PGlite database helpers for integration tests
 *
 * Provides in-memory PostgreSQL for isolated test execution.
 * Schema matches production database structure.
 */
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@slack-speak/database';
let pgLite = null;
let testDb = null;
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
  CREATE INDEX installations_workspace_id_idx ON installations(workspace_id);

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
export async function seedWorkspace(options = {}) {
    if (!pgLite) {
        throw new Error('PGlite not initialized. Call setupTestDb() first.');
    }
    const teamId = options.teamId ?? 'T123';
    const name = options.name ?? 'Test Workspace';
    const botToken = options.botToken ?? 'xoxb-test-token';
    const botUserId = options.botUserId ?? 'B123';
    const result = await pgLite.query(`
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
//# sourceMappingURL=db.js.map