import 'server-only';
import { db, schema } from '@/lib/db';
import { eq, and, gte, lte, or, sql } from 'drizzle-orm';
import Stripe from 'stripe';

const { coupons, couponRedemptions } = schema;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-01-27.acacia',
});

export interface CouponValidation {
  valid: boolean;
  coupon?: typeof coupons.$inferSelect;
  error?: string;
  discount?: {
    type: 'percent' | 'fixed';
    value: number;
    displayValue: string;
  };
}

/**
 * Validate a coupon code
 */
export async function validateCoupon(
  code: string,
  email: string,
  planId?: string
): Promise<CouponValidation> {
  const normalizedCode = code.toUpperCase().trim();

  // Find coupon
  const coupon = await db.query.coupons.findFirst({
    where: eq(coupons.code, normalizedCode),
  });

  if (!coupon) {
    return { valid: false, error: 'Invalid coupon code' };
  }

  // Check if active
  if (!coupon.isActive) {
    return { valid: false, error: 'This coupon is no longer active' };
  }

  // Check validity dates
  const now = new Date();
  if (coupon.validFrom && coupon.validFrom > now) {
    return { valid: false, error: 'This coupon is not yet valid' };
  }
  if (coupon.validUntil && coupon.validUntil < now) {
    return { valid: false, error: 'This coupon has expired' };
  }

  // Check redemption limit
  if (coupon.maxRedemptions && coupon.currentRedemptions >= coupon.maxRedemptions) {
    return { valid: false, error: 'This coupon has reached its redemption limit' };
  }

  // Check first-time only
  if (coupon.firstTimeOnly) {
    const previousRedemption = await db.query.couponRedemptions.findFirst({
      where: eq(couponRedemptions.email, email.toLowerCase()),
    });
    if (previousRedemption) {
      return { valid: false, error: 'This coupon is for first-time subscribers only' };
    }
  }

  // Check applicable plans
  if (planId && coupon.applicablePlans) {
    const plans = coupon.applicablePlans as string[];
    if (plans.length > 0 && !plans.includes(planId)) {
      return { valid: false, error: 'This coupon is not valid for the selected plan' };
    }
  }

  // Calculate discount display
  const discount = {
    type: coupon.discountType as 'percent' | 'fixed',
    value: coupon.discountValue,
    displayValue:
      coupon.discountType === 'percent'
        ? `${coupon.discountValue}% off`
        : `$${(coupon.discountValue / 100).toFixed(2)} off`,
  };

  return {
    valid: true,
    coupon,
    discount,
  };
}

/**
 * Apply coupon at checkout - create Stripe coupon if needed
 */
export async function applyCouponToCheckout(
  couponId: string
): Promise<string | null> {
  const coupon = await db.query.coupons.findFirst({
    where: eq(coupons.id, couponId),
  });

  if (!coupon) return null;

  // If we already have a Stripe coupon ID, use it
  if (coupon.stripeCouponId) {
    return coupon.stripeCouponId;
  }

  // Create Stripe coupon
  const stripeCoupon = await stripe.coupons.create({
    id: `coupon_${coupon.code.toLowerCase()}`,
    ...(coupon.discountType === 'percent'
      ? { percent_off: coupon.discountValue }
      : { amount_off: coupon.discountValue, currency: 'usd' }),
    duration: 'once', // Apply once for first payment
    name: coupon.description || coupon.code,
    max_redemptions: coupon.maxRedemptions || undefined,
    redeem_by: coupon.validUntil
      ? Math.floor(coupon.validUntil.getTime() / 1000)
      : undefined,
  });

  // Save Stripe coupon ID
  await db
    .update(coupons)
    .set({ stripeCouponId: stripeCoupon.id })
    .where(eq(coupons.id, couponId));

  return stripeCoupon.id;
}

/**
 * Record coupon redemption after successful payment
 */
export async function recordCouponRedemption(
  couponId: string,
  email: string,
  organizationId: string | null,
  discountApplied: number
) {
  // Record redemption
  await db.insert(couponRedemptions).values({
    couponId,
    email: email.toLowerCase(),
    organizationId: organizationId || undefined,
    discountApplied,
  });

  // Increment redemption count
  await db
    .update(coupons)
    .set({
      currentRedemptions: sql`${coupons.currentRedemptions} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(coupons.id, couponId));
}

/**
 * Create a new coupon (admin function)
 */
export async function createCoupon(params: {
  code: string;
  description?: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  validUntil?: Date;
  maxRedemptions?: number;
  applicablePlans?: string[];
  firstTimeOnly?: boolean;
  minSeats?: number;
}) {
  const normalizedCode = params.code.toUpperCase().trim();

  // Check if code already exists
  const existing = await db.query.coupons.findFirst({
    where: eq(coupons.code, normalizedCode),
  });

  if (existing) {
    throw new Error('Coupon code already exists');
  }

  const [coupon] = await db
    .insert(coupons)
    .values({
      code: normalizedCode,
      description: params.description,
      discountType: params.discountType,
      discountValue: params.discountValue,
      validUntil: params.validUntil,
      maxRedemptions: params.maxRedemptions,
      applicablePlans: params.applicablePlans,
      firstTimeOnly: params.firstTimeOnly ?? true,
      minSeats: params.minSeats,
    })
    .returning();

  return coupon;
}

/**
 * Deactivate a coupon
 */
export async function deactivateCoupon(couponId: string) {
  await db
    .update(coupons)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(coupons.id, couponId));
}

/**
 * Get all coupons (admin)
 */
export async function getAllCoupons() {
  return db.query.coupons.findMany({
    orderBy: (coupons, { desc }) => [desc(coupons.createdAt)],
  });
}

/**
 * Get coupon stats (admin)
 */
export async function getCouponStats(couponId: string) {
  const redemptions = await db
    .select({
      count: sql<number>`count(*)::int`,
      totalSaved: sql<number>`sum(discount_applied)::int`,
    })
    .from(couponRedemptions)
    .where(eq(couponRedemptions.couponId, couponId));

  return {
    redemptions: redemptions[0]?.count || 0,
    totalSaved: redemptions[0]?.totalSaved || 0,
  };
}
