/**
 * Tests for Usage Enforcement Service
 *
 * Tests cover:
 * - Checking usage limits for different plan types
 * - Recording usage events
 * - Getting usage status
 * - Handling edge cases (no email, no subscription)
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import * as schema from '@slack-speak/database';

// Test database
let pgLite: PGlite;
let testDb: ReturnType<typeof drizzle<typeof schema>>;

const createTablesSQL = `
  CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id TEXT NOT NULL UNIQUE,
    enterprise_id TEXT,
    name TEXT,
    organization_id UUID,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    slack_user_id TEXT NOT NULL,
    email TEXT,
    role TEXT DEFAULT 'member',
    assistant_delivery BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE INDEX users_workspace_id_idx ON users(workspace_id);
  CREATE INDEX users_slack_user_id_idx ON users(slack_user_id);

  CREATE TABLE user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    subscription_status TEXT,
    plan_id TEXT,
    trial_ends_at TIMESTAMP,
    admin_override BOOLEAN DEFAULT false NOT NULL,
    override_reason TEXT,
    overridden_by TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
  CREATE UNIQUE INDEX user_subscriptions_email_idx ON user_subscriptions(email);

  CREATE TABLE usage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT,
    organization_id UUID,
    billing_period_start TIMESTAMP NOT NULL,
    billing_period_end TIMESTAMP NOT NULL,
    suggestions_used INTEGER DEFAULT 0 NOT NULL,
    suggestions_included INTEGER NOT NULL,
    bonus_suggestions INTEGER DEFAULT 0 NOT NULL,
    overage_reported BOOLEAN DEFAULT false,
    stripe_subscription_item_id TEXT,
    stripe_meter_id TEXT,
    plan_id TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
  CREATE UNIQUE INDEX usage_records_email_period_idx ON usage_records(email, billing_period_start);

  CREATE TABLE usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT,
    organization_id UUID,
    slack_user_id TEXT NOT NULL,
    workspace_id UUID,
    event_type TEXT NOT NULL,
    channel_id TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    estimated_cost INTEGER,
    stripe_reported_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
  );
  CREATE INDEX usage_events_email_idx ON usage_events(email);
`;

// Mock the database module
vi.mock('@slack-speak/database', async () => {
  const actual = await vi.importActual('@slack-speak/database');
  return {
    ...actual,
    get db() {
      return testDb;
    },
  };
});

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocks
import { checkUsageAllowed, recordUsageEvent, getUsageStatus } from './usage-enforcement.js';

// Test helpers
let workspaceId: string;

async function createTestWorkspace() {
  const result = await pgLite.query<{ id: string }>(`
    INSERT INTO workspaces (team_id, name)
    VALUES ('T123', 'Test Workspace')
    RETURNING id
  `);
  return result.rows[0].id;
}

async function createTestUser(wsId: string, email: string | null = 'test@example.com') {
  await pgLite.query(`
    INSERT INTO users (workspace_id, slack_user_id, email)
    VALUES ($1, 'U123', $2)
  `, [wsId, email]);
}

async function createSubscription(email: string, planId: string, status: string = 'active') {
  await pgLite.query(`
    INSERT INTO user_subscriptions (email, plan_id, subscription_status)
    VALUES ($1, $2, $3)
  `, [email, planId, status]);
}

async function setUsageRecord(email: string, used: number, included: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  await pgLite.query(`
    INSERT INTO usage_records (email, billing_period_start, billing_period_end, suggestions_used, suggestions_included)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (email, billing_period_start) DO UPDATE
    SET suggestions_used = $4, suggestions_included = $5
  `, [email, start, end, used, included]);
}

describe('Usage Enforcement', () => {
  beforeAll(async () => {
    pgLite = new PGlite();
    testDb = drizzle(pgLite, { schema });
    await pgLite.exec(createTablesSQL);
  });

  afterAll(async () => {
    if (pgLite) {
      await pgLite.close();
    }
  });

  beforeEach(async () => {
    await pgLite.exec(`
      TRUNCATE TABLE usage_events CASCADE;
      TRUNCATE TABLE usage_records CASCADE;
      TRUNCATE TABLE user_subscriptions CASCADE;
      TRUNCATE TABLE users CASCADE;
      TRUNCATE TABLE workspaces CASCADE;
    `);
    workspaceId = await createTestWorkspace();
  });

  describe('checkUsageAllowed', () => {
    it('should allow usage for new user with default limits', async () => {
      await createTestUser(workspaceId, null); // No email

      const result = await checkUsageAllowed({
        workspaceId,
        userId: 'U123',
      });

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(5); // Free tier default
      expect(result.currentUsage).toBe(0);
    });

    it('should allow usage for free tier user under limit', async () => {
      await createTestUser(workspaceId, 'test@example.com');
      await setUsageRecord('test@example.com', 3, 5);

      const result = await checkUsageAllowed({
        workspaceId,
        userId: 'U123',
      });

      expect(result.allowed).toBe(true);
      expect(result.currentUsage).toBe(3);
      expect(result.limit).toBe(5);
      expect(result.isOverage).toBe(false);
    });

    it('should deny usage for free tier user at limit', async () => {
      await createTestUser(workspaceId, 'test@example.com');
      await setUsageRecord('test@example.com', 5, 5);

      const result = await checkUsageAllowed({
        workspaceId,
        userId: 'U123',
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('limit_reached');
      expect(result.isOverage).toBe(true);
    });

    it('should allow overage for paid plan (starter)', async () => {
      await createTestUser(workspaceId, 'paid@example.com');
      await createSubscription('paid@example.com', 'starter', 'active');
      await setUsageRecord('paid@example.com', 25, 25); // At limit

      const result = await checkUsageAllowed({
        workspaceId,
        userId: 'U123',
      });

      expect(result.allowed).toBe(true); // Paid plans allow overage
      expect(result.isOverage).toBe(true);
      expect(result.overageCount).toBeDefined();
    });

    it('should allow overage for pro plan', async () => {
      await createTestUser(workspaceId, 'pro@example.com');
      await createSubscription('pro@example.com', 'pro', 'active');
      await setUsageRecord('pro@example.com', 80, 75); // Over limit

      const result = await checkUsageAllowed({
        workspaceId,
        userId: 'U123',
      });

      expect(result.allowed).toBe(true);
      expect(result.isOverage).toBe(true);
      expect(result.overageCount).toBe(6); // 80 - 75 + 1
    });

    it('should use correct limit for starter plan', async () => {
      await createTestUser(workspaceId, 'starter@example.com');
      await createSubscription('starter@example.com', 'starter', 'active');

      const result = await checkUsageAllowed({
        workspaceId,
        userId: 'U123',
      });

      expect(result.limit).toBe(25);
    });

    it('should use correct limit for pro plan', async () => {
      await createTestUser(workspaceId, 'pro@example.com');
      await createSubscription('pro@example.com', 'pro', 'active');

      const result = await checkUsageAllowed({
        workspaceId,
        userId: 'U123',
      });

      expect(result.limit).toBe(75);
    });

    it('should treat inactive subscription as free tier', async () => {
      await createTestUser(workspaceId, 'canceled@example.com');
      await createSubscription('canceled@example.com', 'pro', 'canceled');

      const result = await checkUsageAllowed({
        workspaceId,
        userId: 'U123',
      });

      expect(result.limit).toBe(5); // Free tier
    });
  });

  describe('recordUsageEvent', () => {
    it('should increment usage count', async () => {
      await createTestUser(workspaceId, 'test@example.com');
      await setUsageRecord('test@example.com', 0, 25);

      await recordUsageEvent({
        workspaceId,
        userId: 'U123',
        eventType: 'suggestion',
      });

      const records = await pgLite.query<{ suggestions_used: number }>(`
        SELECT suggestions_used FROM usage_records WHERE email = 'test@example.com'
      `);

      expect(records.rows[0].suggestions_used).toBe(1);
    });

    it('should create usage event record', async () => {
      await createTestUser(workspaceId, 'test@example.com');
      await setUsageRecord('test@example.com', 0, 25);

      await recordUsageEvent({
        workspaceId,
        userId: 'U123',
        eventType: 'suggestion',
        channelId: 'C123',
      });

      const events = await pgLite.query<{ event_type: string; channel_id: string }>(`
        SELECT event_type, channel_id FROM usage_events WHERE email = 'test@example.com'
      `);

      expect(events.rows).toHaveLength(1);
      expect(events.rows[0].event_type).toBe('suggestion');
      expect(events.rows[0].channel_id).toBe('C123');
    });

    it('should handle user without email gracefully', async () => {
      await createTestUser(workspaceId, null);

      // Should not throw
      await recordUsageEvent({
        workspaceId,
        userId: 'U123',
        eventType: 'suggestion',
      });

      // No record should be created
      const events = await pgLite.query(`SELECT * FROM usage_events`);
      expect(events.rows).toHaveLength(0);
    });

    it('should record refinement events', async () => {
      await createTestUser(workspaceId, 'test@example.com');
      await setUsageRecord('test@example.com', 0, 25);

      await recordUsageEvent({
        workspaceId,
        userId: 'U123',
        eventType: 'refinement',
      });

      const events = await pgLite.query<{ event_type: string }>(`
        SELECT event_type FROM usage_events WHERE email = 'test@example.com'
      `);

      expect(events.rows[0].event_type).toBe('refinement');
    });
  });

  describe('getUsageStatus', () => {
    it('should return correct usage stats', async () => {
      await createTestUser(workspaceId, 'test@example.com');
      await createSubscription('test@example.com', 'pro', 'active');
      await setUsageRecord('test@example.com', 30, 75);

      const status = await getUsageStatus({
        workspaceId,
        userId: 'U123',
      });

      expect(status.used).toBe(30);
      expect(status.limit).toBe(75);
      expect(status.percentUsed).toBe(40);
      expect(status.isNearLimit).toBe(false);
      expect(status.isAtLimit).toBe(false);
      expect(status.planId).toBe('pro');
    });

    it('should detect near limit (80%+)', async () => {
      await createTestUser(workspaceId, 'test@example.com');
      await createSubscription('test@example.com', 'starter', 'active');
      await setUsageRecord('test@example.com', 22, 25); // 88%

      const status = await getUsageStatus({
        workspaceId,
        userId: 'U123',
      });

      expect(status.isNearLimit).toBe(true);
      expect(status.isAtLimit).toBe(false);
    });

    it('should detect at limit (100%+)', async () => {
      await createTestUser(workspaceId, 'test@example.com');
      await createSubscription('test@example.com', 'starter', 'active');
      await setUsageRecord('test@example.com', 25, 25); // 100%

      const status = await getUsageStatus({
        workspaceId,
        userId: 'U123',
      });

      expect(status.isAtLimit).toBe(true);
    });

    it('should return free plan for user without email', async () => {
      await createTestUser(workspaceId, null);

      const status = await getUsageStatus({
        workspaceId,
        userId: 'U123',
      });

      expect(status.planId).toBe('free');
      expect(status.limit).toBe(5);
    });
  });
});
