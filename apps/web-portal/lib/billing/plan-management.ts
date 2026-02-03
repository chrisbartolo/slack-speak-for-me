import 'server-only';
import { db, schema } from '@/lib/db';
import { eq, and, desc, sql } from 'drizzle-orm';

const { users, userSubscriptions, usageRecords } = schema;

export interface UserPlanInfo {
  email: string;
  slackUserId: string;
  displayName: string;
  planId: string;
  subscriptionStatus: string | null;
  adminOverride: boolean;
  overrideReason: string | null;
  suggestionsUsed: number;
  suggestionsIncluded: number;
  bonusSuggestions: number;
  effectiveLimit: number;
  billingPeriodStart: Date | null;
  billingPeriodEnd: Date | null;
}

/**
 * Get all users with their plan and usage info for a workspace.
 */
export async function getWorkspaceUserPlans(workspaceId: string): Promise<UserPlanInfo[]> {
  // Get all users in this workspace
  const workspaceUsers = await db
    .select({
      email: users.email,
      slackUserId: users.slackUserId,
    })
    .from(users)
    .where(eq(users.workspaceId, workspaceId))
    .orderBy(desc(users.createdAt));

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const results: UserPlanInfo[] = [];

  for (const user of workspaceUsers) {
    if (!user.email) continue;

    // Get subscription
    const [subscription] = await db
      .select({
        planId: userSubscriptions.planId,
        subscriptionStatus: userSubscriptions.subscriptionStatus,
        adminOverride: userSubscriptions.adminOverride,
        overrideReason: userSubscriptions.overrideReason,
      })
      .from(userSubscriptions)
      .where(eq(userSubscriptions.email, user.email))
      .limit(1);

    // Get current billing period usage
    const [usage] = await db
      .select({
        suggestionsUsed: usageRecords.suggestionsUsed,
        suggestionsIncluded: usageRecords.suggestionsIncluded,
        bonusSuggestions: usageRecords.bonusSuggestions,
        billingPeriodStart: usageRecords.billingPeriodStart,
        billingPeriodEnd: usageRecords.billingPeriodEnd,
      })
      .from(usageRecords)
      .where(
        and(
          eq(usageRecords.email, user.email),
          eq(usageRecords.billingPeriodStart, periodStart)
        )
      )
      .limit(1);

    const suggestionsIncluded = usage?.suggestionsIncluded ?? 5;
    const bonusSuggestions = usage?.bonusSuggestions ?? 0;

    results.push({
      email: user.email,
      slackUserId: user.slackUserId,
      displayName: user.email,
      planId: subscription?.planId ?? 'free',
      subscriptionStatus: subscription?.subscriptionStatus ?? null,
      adminOverride: subscription?.adminOverride ?? false,
      overrideReason: subscription?.overrideReason ?? null,
      suggestionsUsed: usage?.suggestionsUsed ?? 0,
      suggestionsIncluded,
      bonusSuggestions,
      effectiveLimit: suggestionsIncluded + bonusSuggestions,
      billingPeriodStart: usage?.billingPeriodStart ?? null,
      billingPeriodEnd: usage?.billingPeriodEnd ?? null,
    });
  }

  return results;
}

/**
 * Admin: assign a plan to a user (bypasses Stripe).
 */
export async function assignPlan(params: {
  email: string;
  planId: string;
  reason: string;
  adminEmail: string;
}): Promise<void> {
  const { email, planId, reason, adminEmail } = params;

  // Upsert user_subscriptions
  const [existing] = await db
    .select({ id: userSubscriptions.id })
    .from(userSubscriptions)
    .where(eq(userSubscriptions.email, email))
    .limit(1);

  if (existing) {
    await db
      .update(userSubscriptions)
      .set({
        planId,
        subscriptionStatus: 'active',
        adminOverride: true,
        overrideReason: reason,
        overriddenBy: adminEmail,
        updatedAt: new Date(),
      })
      .where(eq(userSubscriptions.id, existing.id));
  } else {
    await db.insert(userSubscriptions).values({
      email,
      planId,
      subscriptionStatus: 'active',
      adminOverride: true,
      overrideReason: reason,
      overriddenBy: adminEmail,
    });
  }

  // Update the current billing period's suggestionsIncluded to match the new plan
  const PLAN_LIMITS: Record<string, number> = {
    free: 5,
    starter: 25,
    pro: 75,
    team: 50,
    business: 100,
  };

  const newLimit = PLAN_LIMITS[planId] ?? 5;
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

  await db
    .update(usageRecords)
    .set({
      suggestionsIncluded: newLimit,
      planId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(usageRecords.email, email),
        eq(usageRecords.billingPeriodStart, periodStart)
      )
    );
}

/**
 * Admin: grant bonus suggestions for current billing period.
 */
export async function grantBonusSuggestions(params: {
  email: string;
  amount: number;
}): Promise<{ newBonus: number; effectiveLimit: number }> {
  const { email, amount } = params;
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // Try to update existing record
  const result = await db
    .update(usageRecords)
    .set({
      bonusSuggestions: sql`${usageRecords.bonusSuggestions} + ${amount}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(usageRecords.email, email),
        eq(usageRecords.billingPeriodStart, periodStart)
      )
    )
    .returning({
      bonusSuggestions: usageRecords.bonusSuggestions,
      suggestionsIncluded: usageRecords.suggestionsIncluded,
    });

  if (result.length > 0) {
    return {
      newBonus: result[0].bonusSuggestions,
      effectiveLimit: result[0].suggestionsIncluded + result[0].bonusSuggestions,
    };
  }

  // No usage record exists yet — create one
  const [subscription] = await db
    .select({ planId: userSubscriptions.planId })
    .from(userSubscriptions)
    .where(eq(userSubscriptions.email, email))
    .limit(1);

  const PLAN_LIMITS: Record<string, number> = {
    free: 5, starter: 25, pro: 75, team: 50, business: 100,
  };
  const planId = subscription?.planId ?? 'free';
  const included = PLAN_LIMITS[planId] ?? 5;

  const [newRecord] = await db
    .insert(usageRecords)
    .values({
      email,
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      suggestionsUsed: 0,
      suggestionsIncluded: included,
      bonusSuggestions: amount,
      overageReported: false,
    })
    .returning({
      bonusSuggestions: usageRecords.bonusSuggestions,
      suggestionsIncluded: usageRecords.suggestionsIncluded,
    });

  return {
    newBonus: newRecord.bonusSuggestions,
    effectiveLimit: newRecord.suggestionsIncluded + newRecord.bonusSuggestions,
  };
}

/**
 * Admin: reset usage counter for current billing period.
 */
export async function resetUsage(email: string): Promise<void> {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

  await db
    .update(usageRecords)
    .set({
      suggestionsUsed: 0,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(usageRecords.email, email),
        eq(usageRecords.billingPeriodStart, periodStart)
      )
    );
}
