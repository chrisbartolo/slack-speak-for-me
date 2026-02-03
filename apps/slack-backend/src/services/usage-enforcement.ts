import { db, usageRecords, usageEvents, userSubscriptions, users, workspaces } from '@slack-speak/database';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

// Plan configuration - keep in sync with web-portal/lib/billing/plans.config.ts
const PLAN_LIMITS: Record<string, { includedSuggestions: number; overageRate: number }> = {
  free: { includedSuggestions: 5, overageRate: 0 }, // Free tier - no overage, hard cap
  starter: { includedSuggestions: 25, overageRate: 35 },
  pro: { includedSuggestions: 75, overageRate: 30 },
  team: { includedSuggestions: 50, overageRate: 25 },
  business: { includedSuggestions: 100, overageRate: 20 },
};

const DEFAULT_LIMIT = { includedSuggestions: 5, overageRate: 0 }; // Default to free tier

// Usage thresholds for warning levels
const USAGE_THRESHOLDS = {
  WARNING: 0.8,    // 80% - show warning
  CRITICAL: 0.95,  // 95% - show critical warning
  HARD_CAP: 1.0,   // 100% - block for free tier
};

interface UsageCheckResult {
  allowed: boolean;
  reason?: 'limit_reached' | 'no_subscription' | 'payment_required';
  currentUsage: number;
  limit: number;
  isOverage: boolean;
  overageCount?: number;
  warningLevel?: 'none' | 'warning' | 'critical';
}

interface UsageRecordContext {
  workspaceId: string;  // UUID
  userId: string;       // Slack user ID
}

/**
 * Get the current billing period boundaries (calendar month)
 */
function getBillingPeriod(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

/**
 * Get user's email from workspace and slack user ID
 */
async function getUserEmail(workspaceId: string, slackUserId: string): Promise<string | null> {
  try {
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(
        and(
          eq(users.workspaceId, workspaceId),
          eq(users.slackUserId, slackUserId)
        )
      )
      .limit(1);

    return user?.email || null;
  } catch (error) {
    logger.warn({ error, workspaceId, slackUserId }, 'Failed to get user email');
    return null;
  }
}

/**
 * Get or create usage record for the current billing period
 */
async function getOrCreateUsageRecord(
  email: string
): Promise<typeof usageRecords.$inferSelect | null> {
  const { start, end } = getBillingPeriod();

  try {
    // Try to find existing record
    const [existing] = await db
      .select()
      .from(usageRecords)
      .where(
        and(
          eq(usageRecords.email, email),
          eq(usageRecords.billingPeriodStart, start)
        )
      )
      .limit(1);

    if (existing) {
      return existing;
    }

    // Get user's subscription to determine plan
    const [subscription] = await db
      .select({
        planId: userSubscriptions.planId,
        subscriptionStatus: userSubscriptions.subscriptionStatus,
        stripeSubscriptionId: userSubscriptions.stripeSubscriptionId,
      })
      .from(userSubscriptions)
      .where(eq(userSubscriptions.email, email))
      .limit(1);

    let planId = 'free';
    let suggestionsIncluded = DEFAULT_LIMIT.includedSuggestions;

    if (subscription?.subscriptionStatus === 'active' && subscription.planId) {
      planId = subscription.planId;
      suggestionsIncluded = PLAN_LIMITS[planId]?.includedSuggestions || DEFAULT_LIMIT.includedSuggestions;
    }

    // Create new record
    const [newRecord] = await db
      .insert(usageRecords)
      .values({
        email,
        billingPeriodStart: start,
        billingPeriodEnd: end,
        suggestionsUsed: 0,
        suggestionsIncluded,
        overageReported: false,
      })
      .returning();

    return newRecord;
  } catch (error) {
    logger.error({ error, email }, 'Failed to get/create usage record');
    return null;
  }
}

/**
 * Check if AI generation is allowed for this user
 */
export async function checkUsageAllowed(
  context: UsageRecordContext
): Promise<UsageCheckResult> {
  const { workspaceId, userId } = context;

  try {
    // Get user's email
    const email = await getUserEmail(workspaceId, userId);

    if (!email) {
      // If no email, allow with default limits (new user in free tier)
      logger.warn({ workspaceId, userId }, 'User has no email, using default limits');
      return {
        allowed: true,
        currentUsage: 0,
        limit: DEFAULT_LIMIT.includedSuggestions,
        isOverage: false,
      };
    }

    const record = await getOrCreateUsageRecord(email);

    if (!record) {
      // If we can't get a record, allow with default limits (fail open for UX)
      logger.warn({ email }, 'Could not get usage record, allowing with default');
      return {
        allowed: true,
        currentUsage: 0,
        limit: DEFAULT_LIMIT.includedSuggestions,
        isOverage: false,
      };
    }

    const currentUsage = record.suggestionsUsed;
    const limit = record.suggestionsIncluded;
    const isOverage = currentUsage >= limit;

    // Get user's subscription to check for overage allowance
    const [subscription] = await db
      .select({ planId: userSubscriptions.planId })
      .from(userSubscriptions)
      .where(eq(userSubscriptions.email, email))
      .limit(1);

    const planId = subscription?.planId || 'free';
    const planConfig = PLAN_LIMITS[planId] || DEFAULT_LIMIT;

    // Free tier: hard cap, no overage
    if (planId === 'free' && currentUsage >= limit) {
      return {
        allowed: false,
        reason: 'limit_reached',
        currentUsage,
        limit,
        isOverage: true,
      };
    }

    // Paid tiers: allow overage (will be billed)
    if (isOverage && planConfig.overageRate === 0) {
      // No overage rate means hard cap
      return {
        allowed: false,
        reason: 'limit_reached',
        currentUsage,
        limit,
        isOverage: true,
      };
    }

    // Calculate overage count for billing purposes
    const overageCount = Math.max(0, currentUsage - limit);

    // Calculate warning level
    const usagePercent = currentUsage / limit;
    let warningLevel: 'none' | 'warning' | 'critical' = 'none';
    if (usagePercent >= USAGE_THRESHOLDS.CRITICAL) {
      warningLevel = 'critical';
    } else if (usagePercent >= USAGE_THRESHOLDS.WARNING) {
      warningLevel = 'warning';
    }

    return {
      allowed: true,
      currentUsage,
      limit,
      isOverage,
      overageCount: isOverage ? overageCount + 1 : undefined,
      warningLevel,
    };
  } catch (error) {
    logger.error({ error, workspaceId, userId }, 'Error checking usage');
    // Fail open for UX - don't block users due to internal errors
    return {
      allowed: true,
      currentUsage: 0,
      limit: DEFAULT_LIMIT.includedSuggestions,
      isOverage: false,
      warningLevel: 'none',
    };
  }
}

/**
 * Record a usage event after successful AI generation
 */
export async function recordUsageEvent(
  context: UsageRecordContext & {
    eventType: 'suggestion' | 'refinement';
    tokensUsed?: number;
    costEstimate?: number;
    channelId?: string;
  }
): Promise<void> {
  const { workspaceId, userId, eventType, tokensUsed, costEstimate, channelId } = context;

  try {
    // Get user's email
    const email = await getUserEmail(workspaceId, userId);

    if (!email) {
      logger.warn({ workspaceId, userId }, 'Could not record usage - user has no email');
      return;
    }

    const record = await getOrCreateUsageRecord(email);

    if (!record) {
      logger.warn({ email }, 'Could not record usage - no record found');
      return;
    }

    // Update usage record with atomic increment (prevents race conditions)
    await db
      .update(usageRecords)
      .set({
        suggestionsUsed: sql`${usageRecords.suggestionsUsed} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(usageRecords.id, record.id));

    // Record individual event
    await db.insert(usageEvents).values({
      email,
      slackUserId: userId,
      workspaceId,
      eventType,
      channelId,
      inputTokens: tokensUsed ? Math.floor(tokensUsed * 0.3) : null, // Approximate split
      outputTokens: tokensUsed ? Math.floor(tokensUsed * 0.7) : null,
      estimatedCost: costEstimate || null,
    });

    const newUsageCount = record.suggestionsUsed + 1;
    const isOverage = newUsageCount > record.suggestionsIncluded;

    logger.info({
      email,
      userId,
      eventType,
      newUsageCount,
      limit: record.suggestionsIncluded,
      isOverage,
    }, 'Usage event recorded');
  } catch (error) {
    // Non-fatal - don't fail the request if usage tracking fails
    logger.error({ error, workspaceId, userId, eventType }, 'Failed to record usage event');
  }
}

/**
 * Get usage status for display
 */
export async function getUsageStatus(
  context: UsageRecordContext
): Promise<{
  used: number;
  limit: number;
  percentUsed: number;
  isNearLimit: boolean;
  isAtLimit: boolean;
  planId: string;
  warningLevel: 'none' | 'warning' | 'critical';
  overageRate: number;
}> {
  const { workspaceId, userId } = context;

  try {
    const email = await getUserEmail(workspaceId, userId);

    if (!email) {
      return {
        used: 0,
        limit: DEFAULT_LIMIT.includedSuggestions,
        percentUsed: 0,
        isNearLimit: false,
        isAtLimit: false,
        planId: 'free',
        warningLevel: 'none',
        overageRate: DEFAULT_LIMIT.overageRate,
      };
    }

    const record = await getOrCreateUsageRecord(email);

    if (!record) {
      return {
        used: 0,
        limit: DEFAULT_LIMIT.includedSuggestions,
        percentUsed: 0,
        isNearLimit: false,
        isAtLimit: false,
        planId: 'free',
        warningLevel: 'none',
        overageRate: DEFAULT_LIMIT.overageRate,
      };
    }

    // Get subscription for plan info
    const [subscription] = await db
      .select({ planId: userSubscriptions.planId })
      .from(userSubscriptions)
      .where(eq(userSubscriptions.email, email))
      .limit(1);

    const planId = subscription?.planId || 'free';
    const planConfig = PLAN_LIMITS[planId] || DEFAULT_LIMIT;
    const percentUsed = (record.suggestionsUsed / record.suggestionsIncluded) * 100;
    const usagePercent = record.suggestionsUsed / record.suggestionsIncluded;

    // Calculate warning level
    let warningLevel: 'none' | 'warning' | 'critical' = 'none';
    if (usagePercent >= USAGE_THRESHOLDS.CRITICAL) {
      warningLevel = 'critical';
    } else if (usagePercent >= USAGE_THRESHOLDS.WARNING) {
      warningLevel = 'warning';
    }

    return {
      used: record.suggestionsUsed,
      limit: record.suggestionsIncluded,
      percentUsed,
      isNearLimit: percentUsed >= 80 && percentUsed < 100,
      isAtLimit: percentUsed >= 100,
      planId,
      warningLevel,
      overageRate: planConfig.overageRate,
    };
  } catch (error) {
    logger.error({ error, workspaceId, userId }, 'Error getting usage status');
    return {
      used: 0,
      limit: DEFAULT_LIMIT.includedSuggestions,
      percentUsed: 0,
      isNearLimit: false,
      isAtLimit: false,
      planId: 'free',
      warningLevel: 'none',
      overageRate: DEFAULT_LIMIT.overageRate,
    };
  }
}
