/**
 * Tests for Referral Program Logic
 *
 * Tests cover:
 * - Creating and retrieving referral codes
 * - Recording referral signups
 * - Tracking referral conversions
 * - Calculating referral rewards
 * - Processing referral payouts
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq, and, sql } from 'drizzle-orm';
import * as schema from '@slack-speak/database';

// Test database setup
let pgLite: PGlite;
let testDb: ReturnType<typeof drizzle<typeof schema>>;

const createTablesSQL = `
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
`;

// Mock the db module
vi.mock('@/lib/db', async () => {
  const actual = await vi.importActual('@slack-speak/database');
  return {
    db: {
      get query() {
        return testDb.query;
      },
      insert: (...args: Parameters<typeof testDb.insert>) => testDb.insert(...args),
      update: (...args: Parameters<typeof testDb.update>) => testDb.update(...args),
      select: (...args: Parameters<typeof testDb.select>) => testDb.select(...args),
    },
    schema: actual,
  };
});

// Mock server-only (it throws in non-server contexts)
vi.mock('server-only', () => ({}));

// Mock stripe to avoid import resolution issues
vi.mock('@/lib/stripe', () => ({
  getStripe: vi.fn().mockReturnValue({
    customers: {
      createBalanceTransaction: vi.fn().mockResolvedValue({}),
    },
  }),
}));

// Mock nanoid to return predictable IDs
vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('ABCD'),
}));

// Import the module under test AFTER setting up mocks
import {
  REFERRAL_CONFIG,
  getOrCreateReferral,
  getReferralByCode,
  recordReferralSignup,
  getRefereeDiscount,
  recordReferralSubscription,
  getReferralDashboard,
} from './referrals';

describe('Referral System', () => {
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
      TRUNCATE TABLE referral_events CASCADE;
      TRUNCATE TABLE referrals CASCADE;
      TRUNCATE TABLE user_subscriptions CASCADE;
    `);
  });

  describe('REFERRAL_CONFIG', () => {
    it('should have correct reward amount', () => {
      expect(REFERRAL_CONFIG.referrerReward).toBe(1500); // €15
    });

    it('should have correct discount percentage', () => {
      expect(REFERRAL_CONFIG.refereeDiscount).toBe(20); // 20%
    });

    it('should have 14-day minimum before reward', () => {
      expect(REFERRAL_CONFIG.minDaysBeforeReward).toBe(14);
    });

    it('should have gamification milestones', () => {
      expect(REFERRAL_CONFIG.milestones).toBeDefined();
      expect(REFERRAL_CONFIG.milestones.length).toBeGreaterThan(0);
      expect(REFERRAL_CONFIG.milestones[0]).toHaveProperty('count');
      expect(REFERRAL_CONFIG.milestones[0]).toHaveProperty('name');
      expect(REFERRAL_CONFIG.milestones[0]).toHaveProperty('reward');
    });
  });

  describe('getOrCreateReferral', () => {
    it('should create new referral for new user', async () => {
      const referral = await getOrCreateReferral('test@example.com');

      expect(referral).toBeDefined();
      expect(referral.referrerEmail).toBe('test@example.com');
      expect(referral.referralCode).toBeDefined();
      expect(referral.referralCode.length).toBeGreaterThan(0);
    });

    it('should return existing referral for returning user', async () => {
      const first = await getOrCreateReferral('test@example.com');
      const second = await getOrCreateReferral('test@example.com');

      expect(second.id).toBe(first.id);
      expect(second.referralCode).toBe(first.referralCode);
    });

    it('should normalize email to lowercase', async () => {
      const referral = await getOrCreateReferral('TEST@EXAMPLE.COM');

      expect(referral.referrerEmail).toBe('test@example.com');
    });

    it('should initialize counters to zero', async () => {
      const referral = await getOrCreateReferral('test@example.com');

      expect(referral.totalReferrals).toBe(0);
      expect(referral.successfulReferrals).toBe(0);
      expect(referral.totalRewardsEarned).toBe(0);
    });
  });

  describe('getReferralByCode', () => {
    it('should find referral by code (case insensitive)', async () => {
      const created = await getOrCreateReferral('test@example.com');
      const found = await getReferralByCode(created.referralCode.toLowerCase());

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should return undefined for non-existent code', async () => {
      const found = await getReferralByCode('NONEXISTENT');

      expect(found).toBeUndefined();
    });
  });

  describe('recordReferralSignup', () => {
    it('should record signup for valid referral code', async () => {
      const referral = await getOrCreateReferral('referrer@example.com');
      const event = await recordReferralSignup(referral.referralCode, 'referee@example.com');

      expect(event).toBeDefined();
      expect(event?.refereeEmail).toBe('referee@example.com');
      expect(event?.status).toBe('signed_up');
      expect(event?.referrerReward).toBe(REFERRAL_CONFIG.referrerReward);
      expect(event?.refereeDiscount).toBe(REFERRAL_CONFIG.refereeDiscount);
    });

    it('should increment total referrals count', async () => {
      const referral = await getOrCreateReferral('referrer@example.com');
      await recordReferralSignup(referral.referralCode, 'referee@example.com');

      // Fetch updated referral
      const updated = await getReferralByCode(referral.referralCode);
      expect(updated?.totalReferrals).toBe(1);
    });

    it('should reject self-referral', async () => {
      const referral = await getOrCreateReferral('test@example.com');
      const event = await recordReferralSignup(referral.referralCode, 'test@example.com');

      expect(event).toBeNull();
    });

    it('should not duplicate for same referee', async () => {
      const referral = await getOrCreateReferral('referrer@example.com');
      const first = await recordReferralSignup(referral.referralCode, 'referee@example.com');
      const second = await recordReferralSignup(referral.referralCode, 'referee@example.com');

      expect(first).toBeDefined();
      expect(second?.id).toBe(first?.id); // Returns existing, not new
    });

    it('should return null for invalid referral code', async () => {
      const event = await recordReferralSignup('INVALID', 'referee@example.com');

      expect(event).toBeNull();
    });

    it('should normalize referee email to lowercase', async () => {
      const referral = await getOrCreateReferral('referrer@example.com');
      const event = await recordReferralSignup(referral.referralCode, 'REFEREE@EXAMPLE.COM');

      expect(event?.refereeEmail).toBe('referee@example.com');
    });
  });

  describe('getRefereeDiscount', () => {
    it('should return discount for referred user', async () => {
      const referral = await getOrCreateReferral('referrer@example.com');
      await recordReferralSignup(referral.referralCode, 'referee@example.com');

      const discount = await getRefereeDiscount('referee@example.com');

      expect(discount.hasDiscount).toBe(true);
      expect(discount.discountPercent).toBe(REFERRAL_CONFIG.refereeDiscount);
      expect(discount.referralEventId).toBeDefined();
    });

    it('should return no discount for non-referred user', async () => {
      const discount = await getRefereeDiscount('nobody@example.com');

      expect(discount.hasDiscount).toBe(false);
      expect(discount.discountPercent).toBe(0);
    });

    it('should normalize email lookup', async () => {
      const referral = await getOrCreateReferral('referrer@example.com');
      await recordReferralSignup(referral.referralCode, 'referee@example.com');

      const discount = await getRefereeDiscount('REFEREE@EXAMPLE.COM');

      expect(discount.hasDiscount).toBe(true);
    });
  });

  describe('recordReferralSubscription', () => {
    it('should update status to subscribed', async () => {
      const referral = await getOrCreateReferral('referrer@example.com');
      await recordReferralSignup(referral.referralCode, 'referee@example.com');
      await recordReferralSubscription('referee@example.com');

      // Check event status
      const events = await testDb
        .select()
        .from(schema.referralEvents)
        .where(eq(schema.referralEvents.refereeEmail, 'referee@example.com'));

      expect(events[0].status).toBe('subscribed');
      expect(events[0].subscribedAt).toBeDefined();
    });

    it('should increment successful referrals count', async () => {
      const referral = await getOrCreateReferral('referrer@example.com');
      await recordReferralSignup(referral.referralCode, 'referee@example.com');
      await recordReferralSubscription('referee@example.com');

      const updated = await getReferralByCode(referral.referralCode);
      expect(updated?.successfulReferrals).toBe(1);
    });

    it('should not double-count subscriptions', async () => {
      const referral = await getOrCreateReferral('referrer@example.com');
      await recordReferralSignup(referral.referralCode, 'referee@example.com');
      await recordReferralSubscription('referee@example.com');
      await recordReferralSubscription('referee@example.com'); // Second call

      const updated = await getReferralByCode(referral.referralCode);
      expect(updated?.successfulReferrals).toBe(1); // Still 1, not 2
    });
  });

  describe('getReferralDashboard', () => {
    it('should return dashboard data with referral link', async () => {
      const dashboard = await getReferralDashboard('test@example.com');

      expect(dashboard.referralCode).toBeDefined();
      expect(dashboard.referralLink).toContain('?ref=');
      expect(dashboard.totalReferrals).toBe(0);
      expect(dashboard.successfulReferrals).toBe(0);
      expect(dashboard.totalRewardsEarned).toBe(0);
      expect(dashboard.pendingRewards).toBe(0);
      expect(dashboard.recentReferrals).toEqual([]);
    });

    it('should include recent referrals', async () => {
      const referral = await getOrCreateReferral('referrer@example.com');
      await recordReferralSignup(referral.referralCode, 'referee1@example.com');
      await recordReferralSignup(referral.referralCode, 'referee2@example.com');

      const dashboard = await getReferralDashboard('referrer@example.com');

      expect(dashboard.recentReferrals).toHaveLength(2);
      // Emails should be masked
      expect(dashboard.recentReferrals[0].email).toContain('***');
    });

    it('should calculate pending rewards correctly', async () => {
      const referral = await getOrCreateReferral('referrer@example.com');
      await recordReferralSignup(referral.referralCode, 'referee@example.com');
      await recordReferralSubscription('referee@example.com');

      const dashboard = await getReferralDashboard('referrer@example.com');

      // Subscribed but not yet rewarded = pending
      expect(dashboard.pendingRewards).toBe(REFERRAL_CONFIG.referrerReward);
    });

    it('should mask email addresses in referral list', async () => {
      const referral = await getOrCreateReferral('referrer@example.com');
      await recordReferralSignup(referral.referralCode, 'longname@example.com');

      const dashboard = await getReferralDashboard('referrer@example.com');

      expect(dashboard.recentReferrals[0].email).toBe('lo***@example.com');
    });
  });
});
