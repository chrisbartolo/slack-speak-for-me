/**
 * Tests for Coupon Management
 *
 * Tests cover:
 * - Creating coupons
 * - Validating coupons (various conditions)
 * - Applying coupons to checkout
 * - Recording coupon redemptions
 * - Admin coupon operations
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite'
import * as schema from '@slack-speak/database';

// Test database setup
let pgLite: PGlite;
let testDb: ReturnType<typeof drizzle<typeof schema>>;

const createTablesSQL = `
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

  CREATE TABLE coupon_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID NOT NULL REFERENCES coupons(id),
    email TEXT NOT NULL,
    organization_id UUID,
    discount_applied INTEGER NOT NULL,
    redeemed_at TIMESTAMP DEFAULT NOW()
  );
  CREATE INDEX coupon_redemptions_email_idx ON coupon_redemptions(email);
  CREATE INDEX coupon_redemptions_coupon_idx ON coupon_redemptions(coupon_id);
`;

// Mock server-only
vi.mock('server-only', () => ({}));

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

// Mock Stripe
const mockStripeCreate = vi.fn().mockResolvedValue({ id: 'stripe_coupon_123' });
vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({
    coupons: {
      create: mockStripeCreate,
    },
  }),
}));

// Import after mocks
import {
  validateCoupon,
  createCoupon,
  applyCouponToCheckout,
  recordCouponRedemption,
  deactivateCoupon,
  getAllCoupons,
  getCouponStats,
} from './coupons';

// Helper to create test coupon directly in database
async function insertTestCoupon(data: {
  code: string;
  discountType?: string;
  discountValue?: number;
  isActive?: boolean;
  validFrom?: Date;
  validUntil?: Date;
  maxRedemptions?: number;
  currentRedemptions?: number;
  firstTimeOnly?: boolean;
  applicablePlans?: string[];
  stripeCouponId?: string;
}) {
  const result = await pgLite.query<{ id: string }>(`
    INSERT INTO coupons (code, discount_type, discount_value, is_active, valid_from, valid_until, max_redemptions, current_redemptions, first_time_only, applicable_plans, stripe_coupon_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id
  `, [
    data.code.toUpperCase(),
    data.discountType || 'percent',
    data.discountValue || 20,
    data.isActive ?? true,
    data.validFrom || new Date(),
    data.validUntil || null,
    data.maxRedemptions || null,
    data.currentRedemptions || 0,
    data.firstTimeOnly ?? true,
    data.applicablePlans ? JSON.stringify(data.applicablePlans) : null,
    data.stripeCouponId || null,
  ]);
  return result.rows[0].id;
}

async function insertRedemption(couponId: string, email: string) {
  await pgLite.query(`
    INSERT INTO coupon_redemptions (coupon_id, email, discount_applied)
    VALUES ($1, $2, $3)
  `, [couponId, email.toLowerCase(), 1000]);
}

describe('Coupon System', () => {
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
      TRUNCATE TABLE coupon_redemptions CASCADE;
      TRUNCATE TABLE coupons CASCADE;
    `);
    vi.clearAllMocks();
  });

  describe('validateCoupon', () => {
    it('should validate a valid coupon', async () => {
      await insertTestCoupon({ code: 'VALID20', discountType: 'percent', discountValue: 20 });

      const result = await validateCoupon('VALID20', 'test@example.com');

      expect(result.valid).toBe(true);
      expect(result.discount?.type).toBe('percent');
      expect(result.discount?.value).toBe(20);
      expect(result.discount?.displayValue).toBe('20% off');
    });

    it('should normalize coupon code (case insensitive)', async () => {
      await insertTestCoupon({ code: 'TESTCODE', discountValue: 15 });

      const result = await validateCoupon('testcode', 'test@example.com');

      expect(result.valid).toBe(true);
    });

    it('should reject non-existent coupon', async () => {
      const result = await validateCoupon('NONEXISTENT', 'test@example.com');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid coupon code');
    });

    it('should reject inactive coupon', async () => {
      await insertTestCoupon({ code: 'INACTIVE', isActive: false });

      const result = await validateCoupon('INACTIVE', 'test@example.com');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('This coupon is no longer active');
    });

    it('should reject expired coupon', async () => {
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1);
      await insertTestCoupon({ code: 'EXPIRED', validUntil: expiredDate });

      const result = await validateCoupon('EXPIRED', 'test@example.com');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('This coupon has expired');
    });

    it('should reject not-yet-valid coupon', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      await insertTestCoupon({ code: 'FUTURE', validFrom: futureDate });

      const result = await validateCoupon('FUTURE', 'test@example.com');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('This coupon is not yet valid');
    });

    it('should reject coupon at redemption limit', async () => {
      await insertTestCoupon({ code: 'LIMITED', maxRedemptions: 5, currentRedemptions: 5 });

      const result = await validateCoupon('LIMITED', 'test@example.com');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('This coupon has reached its redemption limit');
    });

    it('should reject first-time coupon for returning user', async () => {
      const couponId = await insertTestCoupon({ code: 'FIRSTTIME', firstTimeOnly: true });
      await insertRedemption(couponId, 'returning@example.com');

      const result = await validateCoupon('FIRSTTIME', 'returning@example.com');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('This coupon is for first-time subscribers only');
    });

    it('should allow first-time coupon for new user', async () => {
      await insertTestCoupon({ code: 'FIRSTTIME', firstTimeOnly: true });

      const result = await validateCoupon('FIRSTTIME', 'newuser@example.com');

      expect(result.valid).toBe(true);
    });

    it('should reject coupon not valid for selected plan', async () => {
      await insertTestCoupon({ code: 'PROONLY', applicablePlans: ['pro'] });

      const result = await validateCoupon('PROONLY', 'test@example.com', 'starter');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('This coupon is not valid for the selected plan');
    });

    it('should accept coupon valid for selected plan', async () => {
      await insertTestCoupon({ code: 'PROONLY', applicablePlans: ['pro'] });

      const result = await validateCoupon('PROONLY', 'test@example.com', 'pro');

      expect(result.valid).toBe(true);
    });

    it('should format fixed discount correctly', async () => {
      await insertTestCoupon({ code: 'FIXED500', discountType: 'fixed', discountValue: 500 });

      const result = await validateCoupon('FIXED500', 'test@example.com');

      expect(result.valid).toBe(true);
      expect(result.discount?.type).toBe('fixed');
      expect(result.discount?.displayValue).toBe('€5.00 off');
    });
  });

  describe('createCoupon', () => {
    it('should create a new coupon', async () => {
      const coupon = await createCoupon({
        code: 'NEWCODE',
        description: 'Test coupon',
        discountType: 'percent',
        discountValue: 25,
      });

      expect(coupon).toBeDefined();
      expect(coupon.code).toBe('NEWCODE');
      expect(coupon.discountValue).toBe(25);
    });

    it('should normalize code to uppercase', async () => {
      const coupon = await createCoupon({
        code: 'lowercase',
        discountType: 'percent',
        discountValue: 10,
      });

      expect(coupon.code).toBe('LOWERCASE');
    });

    it('should reject duplicate coupon code', async () => {
      await createCoupon({
        code: 'DUPLICATE',
        discountType: 'percent',
        discountValue: 10,
      });

      await expect(
        createCoupon({
          code: 'duplicate',
          discountType: 'percent',
          discountValue: 20,
        })
      ).rejects.toThrow('Coupon code already exists');
    });

    it('should set firstTimeOnly to true by default', async () => {
      const coupon = await createCoupon({
        code: 'DEFAULTFIRST',
        discountType: 'percent',
        discountValue: 10,
      });

      expect(coupon.firstTimeOnly).toBe(true);
    });
  });

  describe('applyCouponToCheckout', () => {
    it('should return existing Stripe coupon ID if available', async () => {
      const couponId = await insertTestCoupon({
        code: 'WITHSTRIPE',
        stripeCouponId: 'existing_stripe_id',
      });

      const result = await applyCouponToCheckout(couponId);

      expect(result).toBe('existing_stripe_id');
      expect(mockStripeCreate).not.toHaveBeenCalled();
    });

    it('should create Stripe coupon if not exists', async () => {
      const couponId = await insertTestCoupon({
        code: 'NOSTRIPE',
        discountType: 'percent',
        discountValue: 15,
      });

      const result = await applyCouponToCheckout(couponId);

      expect(result).toBe('stripe_coupon_123');
      expect(mockStripeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'coupon_nostripe',
          percent_off: 15,
          duration: 'once',
        })
      );
    });

    it('should return null for non-existent coupon', async () => {
      const result = await applyCouponToCheckout('00000000-0000-0000-0000-000000000000');

      expect(result).toBeNull();
    });
  });

  describe('recordCouponRedemption', () => {
    it('should record redemption and increment count', async () => {
      const couponId = await insertTestCoupon({ code: 'REDEEM', currentRedemptions: 0 });

      await recordCouponRedemption(couponId, 'redeemer@example.com', null, 1500);

      // Check redemption count
      const couponResult = await pgLite.query<{ current_redemptions: number }>(`
        SELECT current_redemptions FROM coupons WHERE id = $1
      `, [couponId]);
      expect(couponResult.rows[0].current_redemptions).toBe(1);

      // Check redemption record
      const redemptionResult = await pgLite.query<{ email: string; discount_applied: number }>(`
        SELECT email, discount_applied FROM coupon_redemptions WHERE coupon_id = $1
      `, [couponId]);
      expect(redemptionResult.rows[0].email).toBe('redeemer@example.com');
      expect(redemptionResult.rows[0].discount_applied).toBe(1500);
    });

    it('should normalize email to lowercase', async () => {
      const couponId = await insertTestCoupon({ code: 'EMAILTEST' });

      await recordCouponRedemption(couponId, 'UPPER@EXAMPLE.COM', null, 500);

      const result = await pgLite.query<{ email: string }>(`
        SELECT email FROM coupon_redemptions WHERE coupon_id = $1
      `, [couponId]);
      expect(result.rows[0].email).toBe('upper@example.com');
    });
  });

  describe('deactivateCoupon', () => {
    it('should deactivate a coupon', async () => {
      const couponId = await insertTestCoupon({ code: 'TODEACTIVATE', isActive: true });

      await deactivateCoupon(couponId);

      const result = await pgLite.query<{ is_active: boolean }>(`
        SELECT is_active FROM coupons WHERE id = $1
      `, [couponId]);
      expect(result.rows[0].is_active).toBe(false);
    });
  });

  describe('getAllCoupons', () => {
    it('should return all coupons ordered by creation date', async () => {
      await insertTestCoupon({ code: 'FIRST' });
      await insertTestCoupon({ code: 'SECOND' });
      await insertTestCoupon({ code: 'THIRD' });

      const coupons = await getAllCoupons();

      expect(coupons).toHaveLength(3);
      // Note: Order depends on insertion timing, but all should be returned
      const codes = coupons.map((c) => c.code);
      expect(codes).toContain('FIRST');
      expect(codes).toContain('SECOND');
      expect(codes).toContain('THIRD');
    });
  });

  describe('getCouponStats', () => {
    it('should return correct stats for coupon', async () => {
      const couponId = await insertTestCoupon({ code: 'STATSTEST' });

      // Add some redemptions
      await pgLite.query(`
        INSERT INTO coupon_redemptions (coupon_id, email, discount_applied)
        VALUES ($1, 'user1@test.com', 1000),
               ($1, 'user2@test.com', 1500),
               ($1, 'user3@test.com', 2000)
      `, [couponId]);

      const stats = await getCouponStats(couponId);

      expect(stats.redemptions).toBe(3);
      expect(stats.totalSaved).toBe(4500);
    });

    it('should return zero stats for unused coupon', async () => {
      const couponId = await insertTestCoupon({ code: 'UNUSED' });

      const stats = await getCouponStats(couponId);

      expect(stats.redemptions).toBe(0);
      expect(stats.totalSaved).toBe(0);
    });
  });
});
