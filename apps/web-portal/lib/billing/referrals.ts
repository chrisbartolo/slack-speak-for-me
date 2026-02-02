import 'server-only';
import { db, schema } from '@/lib/db';
import { eq, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const { referrals, referralEvents, userSubscriptions } = schema;

// Referral program configuration
export const REFERRAL_CONFIG = {
  // What the referrer gets (credit in cents, applied to next invoice)
  referrerReward: 1500, // $15 credit per successful referral

  // What the referee gets (% off first month)
  refereeDiscount: 20, // 20% off first month

  // Minimum days before referral reward is paid (to prevent churn gaming)
  minDaysBeforeReward: 14,
};

/**
 * Get or create referral record for a user
 */
export async function getOrCreateReferral(email: string) {
  const normalizedEmail = email.toLowerCase();

  // Check if referral exists
  let referral = await db.query.referrals.findFirst({
    where: eq(referrals.referrerEmail, normalizedEmail),
  });

  if (referral) {
    return referral;
  }

  // Create new referral with unique code
  const referralCode = generateReferralCode(normalizedEmail);

  [referral] = await db
    .insert(referrals)
    .values({
      referrerEmail: normalizedEmail,
      referralCode,
    })
    .returning();

  return referral;
}

/**
 * Generate unique referral code
 */
function generateReferralCode(email: string): string {
  // Use first part of email + random string
  const prefix = email.split('@')[0].substring(0, 6).toUpperCase();
  const suffix = nanoid(4).toUpperCase();
  return `${prefix}${suffix}`;
}

/**
 * Get referral by code (for checkout)
 */
export async function getReferralByCode(code: string) {
  return db.query.referrals.findFirst({
    where: eq(referrals.referralCode, code.toUpperCase()),
  });
}

/**
 * Record referral signup (when someone uses a referral link)
 */
export async function recordReferralSignup(
  referralCode: string,
  refereeEmail: string
) {
  const normalizedEmail = refereeEmail.toLowerCase();

  // Find the referral
  const referral = await getReferralByCode(referralCode);
  if (!referral) return null;

  // Check if referee is the same as referrer (can't self-refer)
  if (referral.referrerEmail === normalizedEmail) {
    return null;
  }

  // Check if referee already has a referral event
  const existing = await db.query.referralEvents.findFirst({
    where: eq(referralEvents.refereeEmail, normalizedEmail),
  });

  if (existing) {
    return existing; // Already recorded
  }

  // Create referral event
  const [event] = await db
    .insert(referralEvents)
    .values({
      referralId: referral.id,
      refereeEmail: normalizedEmail,
      status: 'signed_up',
      referrerReward: REFERRAL_CONFIG.referrerReward,
      refereeDiscount: REFERRAL_CONFIG.refereeDiscount,
      signedUpAt: new Date(),
    })
    .returning();

  // Increment total referrals count
  await db
    .update(referrals)
    .set({
      totalReferrals: sql`${referrals.totalReferrals} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(referrals.id, referral.id));

  return event;
}

/**
 * Check if user was referred and get their discount
 */
export async function getRefereeDiscount(email: string): Promise<{
  hasDiscount: boolean;
  discountPercent: number;
  referralEventId?: string;
}> {
  const normalizedEmail = email.toLowerCase();

  const event = await db.query.referralEvents.findFirst({
    where: and(
      eq(referralEvents.refereeEmail, normalizedEmail),
      eq(referralEvents.status, 'signed_up')
    ),
  });

  if (!event) {
    return { hasDiscount: false, discountPercent: 0 };
  }

  return {
    hasDiscount: true,
    discountPercent: event.refereeDiscount || REFERRAL_CONFIG.refereeDiscount,
    referralEventId: event.id,
  };
}

/**
 * Record successful subscription (when referee pays)
 */
export async function recordReferralSubscription(refereeEmail: string) {
  const normalizedEmail = refereeEmail.toLowerCase();

  const event = await db.query.referralEvents.findFirst({
    where: eq(referralEvents.refereeEmail, normalizedEmail),
  });

  if (!event || event.status === 'subscribed' || event.status === 'rewarded') {
    return; // Already processed
  }

  // Update event status
  await db
    .update(referralEvents)
    .set({
      status: 'subscribed',
      subscribedAt: new Date(),
    })
    .where(eq(referralEvents.id, event.id));

  // Increment successful referrals
  await db
    .update(referrals)
    .set({
      successfulReferrals: sql`${referrals.successfulReferrals} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(referrals.id, event.referralId));

  // Schedule reward (would be processed by a cron job after minDaysBeforeReward)
  // For now, we just mark it as pending reward
}

/**
 * Process referral rewards (called by cron job)
 * This should be called after minDaysBeforeReward to ensure user doesn't immediately cancel
 */
export async function processReferralRewards() {
  const minDate = new Date();
  minDate.setDate(minDate.getDate() - REFERRAL_CONFIG.minDaysBeforeReward);

  // Find events that are subscribed but not yet rewarded, and are old enough
  const pendingRewards = await db
    .select()
    .from(referralEvents)
    .innerJoin(referrals, eq(referralEvents.referralId, referrals.id))
    .where(
      and(
        eq(referralEvents.status, 'subscribed'),
        sql`${referralEvents.subscribedAt} < ${minDate}`
      )
    );

  for (const { referral_events: event, referrals: referral } of pendingRewards) {
    // Check if referee still has an active subscription
    const subscription = await db.query.userSubscriptions.findFirst({
      where: eq(userSubscriptions.email, event.refereeEmail),
    });

    if (!subscription || subscription.subscriptionStatus !== 'active') {
      continue; // Don't reward if they've already canceled
    }

    // Mark as rewarded
    await db
      .update(referralEvents)
      .set({
        status: 'rewarded',
        rewardedAt: new Date(),
      })
      .where(eq(referralEvents.id, event.id));

    // Add reward to referrer's account
    await db
      .update(referrals)
      .set({
        totalRewardsEarned: sql`${referrals.totalRewardsEarned} + ${event.referrerReward || REFERRAL_CONFIG.referrerReward}`,
        updatedAt: new Date(),
      })
      .where(eq(referrals.id, referral.id));

    // TODO: Apply credit to referrer's Stripe account
    // This would create a credit balance on their next invoice
  }
}

/**
 * Get referral dashboard data for a user
 */
export async function getReferralDashboard(email: string) {
  const normalizedEmail = email.toLowerCase();

  const referral = await db.query.referrals.findFirst({
    where: eq(referrals.referrerEmail, normalizedEmail),
  });

  if (!referral) {
    // Create one
    const newReferral = await getOrCreateReferral(email);
    return {
      referralCode: newReferral.referralCode,
      referralLink: `${process.env.NEXT_PUBLIC_APP_URL || 'https://speakforme.app'}/pricing?ref=${newReferral.referralCode}`,
      totalReferrals: 0,
      successfulReferrals: 0,
      totalRewardsEarned: 0,
      pendingRewards: 0,
      recentReferrals: [],
    };
  }

  // Get recent referral events
  const events = await db.query.referralEvents.findMany({
    where: eq(referralEvents.referralId, referral.id),
    orderBy: (events, { desc }) => [desc(events.createdAt)],
    limit: 10,
  });

  // Calculate pending rewards
  const pendingEvents = events.filter(e => e.status === 'subscribed');
  const pendingRewards = pendingEvents.reduce(
    (sum, e) => sum + (e.referrerReward || REFERRAL_CONFIG.referrerReward),
    0
  );

  return {
    referralCode: referral.referralCode,
    referralLink: `${process.env.NEXT_PUBLIC_APP_URL || 'https://speakforme.app'}/pricing?ref=${referral.referralCode}`,
    totalReferrals: referral.totalReferrals,
    successfulReferrals: referral.successfulReferrals,
    totalRewardsEarned: referral.totalRewardsEarned,
    pendingRewards,
    recentReferrals: events.map(e => ({
      email: maskEmail(e.refereeEmail),
      status: e.status,
      signedUpAt: e.signedUpAt,
      subscribedAt: e.subscribedAt,
      rewardedAt: e.rewardedAt,
    })),
  };
}

/**
 * Mask email for privacy in referral dashboard
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  const maskedLocal = local.substring(0, 2) + '***';
  return `${maskedLocal}@${domain}`;
}

/**
 * Track referral source from URL params
 */
export async function trackReferralFromUrl(
  referralCode: string | null,
  utmSource: string | null,
  utmMedium: string | null,
  utmCampaign: string | null
) {
  // This would typically store in a session or cookie
  // For now, we return the data to be passed through the checkout flow
  return {
    referralCode,
    utmSource,
    utmMedium,
    utmCampaign,
  };
}
