/**
 * PGlite database helpers for web-portal tests
 */

import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@slack-speak/database';

let pgLite: PGlite | null = null;
let testDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

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

  CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id TEXT NOT NULL UNIQUE,
    enterprise_id TEXT,
    name TEXT,
    organization_id UUID REFERENCES organizations(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    slack_user_id TEXT NOT NULL,
    email TEXT,
    role TEXT DEFAULT 'member',
    created_at TIMESTAMP DEFAULT NOW()
  );

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
`;

export async function setupTestDb() {
  if (pgLite) {
    await pgLite.close();
  }

  pgLite = new PGlite();
  testDb = drizzle(pgLite, { schema });
  await pgLite.exec(createTablesSQL);

  return testDb;
}

export async function cleanupTestDb() {
  if (pgLite) {
    await pgLite.close();
    pgLite = null;
    testDb = null;
  }
}

export function getTestDb() {
  if (!testDb) {
    throw new Error('Test DB not initialized');
  }
  return testDb;
}

export function getPGlite() {
  if (!pgLite) {
    throw new Error('PGlite not initialized');
  }
  return pgLite;
}

export async function clearAllTables() {
  if (!pgLite) {
    throw new Error('PGlite not initialized');
  }

  await pgLite.exec(`
    TRUNCATE TABLE referral_events CASCADE;
    TRUNCATE TABLE referrals CASCADE;
    TRUNCATE TABLE coupons CASCADE;
    TRUNCATE TABLE user_subscriptions CASCADE;
    TRUNCATE TABLE users CASCADE;
    TRUNCATE TABLE workspaces CASCADE;
    TRUNCATE TABLE organizations CASCADE;
  `);
}
