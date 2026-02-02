import 'server-only';
import { db, schema } from '@/lib/db';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import {
  getPlanById,
  getIncludedSuggestions,
  USAGE_THRESHOLDS,
} from './plans.config';
import { checkUserAccess } from './access-check';

const { usageRecords, usageEvents, organizations, userSubscriptions } = schema;

export interface UsageStatus {
  used: number;
  included: number;
  remaining: number;
  percentUsed: number;
  isOverLimit: boolean;
  isWarning: boolean;
  isCritical: boolean;
  overage: number;
}

export interface UsageCheckResult {
  allowed: boolean;
  reason?: 'no_subscription' | 'over_limit' | 'trial_expired';
  usage?: UsageStatus;
}

/**
 * Get or create usage record for current billing period
 */
export async function getOrCreateUsageRecord(
  email: string | null,
  organizationId: string | null,
  planId: string,
  seatCount: number = 1
) {
  const now = new Date();
  const periodStart = getbillingPeriodStart(now);
  const periodEnd = getbillingPeriodEnd(now);
  const includedSuggestions = getIncludedSuggestions(planId, seatCount);

  // Try to find existing record
  let record;

  if (email) {
    record = await db.query.usageRecords.findFirst({
      where: and(
        eq(usageRecords.email, email),
        gte(usageRecords.billingPeriodStart, periodStart),
        lte(usageRecords.billingPeriodStart, periodEnd)
      ),
    });
  } else if (organizationId) {
    record = await db.query.usageRecords.findFirst({
      where: and(
        eq(usageRecords.organizationId, organizationId),
        gte(usageRecords.billingPeriodStart, periodStart),
        lte(usageRecords.billingPeriodStart, periodEnd)
      ),
    });
  }

  if (record) {
    return record;
  }

  // Create new record
  const [newRecord] = await db
    .insert(usageRecords)
    .values({
      email: email || undefined,
      organizationId: organizationId || undefined,
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      suggestionsUsed: 0,
      suggestionsIncluded: includedSuggestions,
    })
    .returning();

  return newRecord;
}

/**
 * Get current usage status for a user or org
 */
export async function getUsageStatus(
  email: string | null,
  organizationId: string | null
): Promise<UsageStatus | null> {
  // Get plan details directly
  let planId: string = 'free';
  let seatCount = 1;
  let source: 'individual' | 'organization' = 'individual';

  if (email) {
    const userSub = await db.query.userSubscriptions.findFirst({
      where: eq(userSubscriptions.email, email.toLowerCase()),
    });
    if (userSub?.subscriptionStatus === 'active' || userSub?.subscriptionStatus === 'trialing') {
      planId = userSub.planId || 'starter';
      source = 'individual';
    }
  }

  if (organizationId && planId === 'free') {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
    });
    if (org?.subscriptionStatus === 'active' || org?.subscriptionStatus === 'trialing') {
      planId = org.planId || 'team_starter';
      seatCount = org.seatCount || 1;
      source = 'organization';
    }
  }

  // If still free and no valid subscription found, return null
  if (planId === 'free' && !email && !organizationId) {
    return null;
  }

  const record = await getOrCreateUsageRecord(
    source === 'individual' ? email : null,
    source === 'organization' ? organizationId : null,
    planId,
    seatCount
  );

  const used = record.suggestionsUsed;
  const included = record.suggestionsIncluded;
  const remaining = Math.max(0, included - used);
  const percentUsed = included > 0 ? used / included : 0;
  const overage = Math.max(0, used - included);

  return {
    used,
    included,
    remaining,
    percentUsed,
    isOverLimit: percentUsed >= USAGE_THRESHOLDS.HARD_CAP,
    isWarning: percentUsed >= USAGE_THRESHOLDS.WARNING && percentUsed < USAGE_THRESHOLDS.CRITICAL,
    isCritical: percentUsed >= USAGE_THRESHOLDS.CRITICAL,
    overage,
  };
}

/**
 * Check if user can generate a suggestion (before AI call)
 */
export async function checkUsageAllowed(
  email: string,
  workspaceId: string
): Promise<UsageCheckResult> {
  // First check if user has access at all
  const access = await checkUserAccess(email, workspaceId);

  if (!access.hasAccess) {
    return {
      allowed: false,
      reason: access.reason === 'expired' ? 'trial_expired' : 'no_subscription',
    };
  }

  // Get usage status
  const org = access.source === 'organization'
    ? await db.query.organizations.findFirst({
        where: eq(organizations.id, workspaceId), // This needs to be org ID
      })
    : null;

  const usage = await getUsageStatus(
    access.source === 'individual' ? email : null,
    org?.id || null
  );

  if (!usage) {
    return { allowed: false, reason: 'no_subscription' };
  }

  if (usage.isOverLimit) {
    return {
      allowed: false,
      reason: 'over_limit',
      usage,
    };
  }

  return {
    allowed: true,
    usage,
  };
}

/**
 * Record a usage event (after successful AI generation)
 */
export async function recordUsageEvent(params: {
  email: string;
  organizationId?: string;
  slackUserId: string;
  workspaceId: string;
  eventType: 'suggestion' | 'refinement';
  channelId?: string;
  inputTokens?: number;
  outputTokens?: number;
}) {
  // Insert event record
  await db.insert(usageEvents).values({
    email: params.email,
    organizationId: params.organizationId || undefined,
    slackUserId: params.slackUserId,
    workspaceId: params.workspaceId,
    eventType: params.eventType,
    channelId: params.channelId,
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    estimatedCost: calculateEstimatedCost(params.inputTokens, params.outputTokens),
  });

  // Increment usage count - determine source based on email/org
  const periodStart = getbillingPeriodStart(new Date());
  const periodEnd = getbillingPeriodEnd(new Date());

  // Try to update individual usage record first, then org
  if (params.email) {
    await db
      .update(usageRecords)
      .set({
        suggestionsUsed: sql`${usageRecords.suggestionsUsed} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(usageRecords.email, params.email),
          gte(usageRecords.billingPeriodStart, periodStart),
          lte(usageRecords.billingPeriodEnd, periodEnd)
        )
      );
  } else if (params.organizationId) {
    // Fall back to organization usage record
    await db
      .update(usageRecords)
      .set({
        suggestionsUsed: sql`${usageRecords.suggestionsUsed} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(usageRecords.organizationId, params.organizationId),
          gte(usageRecords.billingPeriodStart, periodStart),
          lte(usageRecords.billingPeriodEnd, periodEnd)
        )
      );
  }
}

/**
 * Get billing period start (first of current month)
 */
function getbillingPeriodStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

/**
 * Get billing period end (last day of current month)
 */
function getbillingPeriodEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

/**
 * Calculate estimated cost in cents based on token usage
 * Using Claude Sonnet 4.5 pricing: $3/M input, $15/M output
 */
function calculateEstimatedCost(
  inputTokens?: number,
  outputTokens?: number
): number {
  const INPUT_COST_PER_M = 300; // $3.00 per million = 300 cents
  const OUTPUT_COST_PER_M = 1500; // $15.00 per million = 1500 cents

  let cost = 0;

  if (inputTokens) {
    cost += Math.ceil((inputTokens / 1_000_000) * INPUT_COST_PER_M * 100) / 100;
  }

  if (outputTokens) {
    cost += Math.ceil((outputTokens / 1_000_000) * OUTPUT_COST_PER_M * 100) / 100;
  }

  return Math.round(cost);
}

/**
 * Get usage analytics for admin dashboard
 */
export async function getUsageAnalytics(organizationId: string) {
  const periodStart = getbillingPeriodStart(new Date());

  // Get current period usage
  const currentUsage = await db.query.usageRecords.findFirst({
    where: and(
      eq(usageRecords.organizationId, organizationId),
      gte(usageRecords.billingPeriodStart, periodStart)
    ),
  });

  // Get event breakdown by type
  const eventsByType = await db
    .select({
      eventType: usageEvents.eventType,
      count: sql<number>`count(*)::int`,
    })
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.organizationId, organizationId),
        gte(usageEvents.createdAt, periodStart)
      )
    )
    .groupBy(usageEvents.eventType);

  // Get top users
  const topUsers = await db
    .select({
      slackUserId: usageEvents.slackUserId,
      count: sql<number>`count(*)::int`,
    })
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.organizationId, organizationId),
        gte(usageEvents.createdAt, periodStart)
      )
    )
    .groupBy(usageEvents.slackUserId)
    .orderBy(sql`count(*) desc`)
    .limit(10);

  return {
    currentPeriod: {
      used: currentUsage?.suggestionsUsed || 0,
      included: currentUsage?.suggestionsIncluded || 0,
      overage: Math.max(0, (currentUsage?.suggestionsUsed || 0) - (currentUsage?.suggestionsIncluded || 0)),
    },
    eventsByType,
    topUsers,
  };
}
