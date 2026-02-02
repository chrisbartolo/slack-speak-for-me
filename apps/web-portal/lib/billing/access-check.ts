import 'server-only';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';

const { userSubscriptions, workspaces, organizations } = schema;

/**
 * Result of access check - indicates whether user has access and why
 */
export type AccessResult =
  | {
      hasAccess: true;
      source: 'individual' | 'organization';
      status: 'active' | 'trialing';
      planId: string | null;
    }
  | {
      hasAccess: false;
      reason: 'no_subscription' | 'paused' | 'canceled' | 'expired';
    };

/**
 * Check if user has access to premium features
 *
 * Priority order:
 * 1. Individual subscription (by email) - checked first
 * 2. Organization subscription (via workspace) - fallback
 *
 * This priority ensures users who leave an org but have personal subs
 * retain access, and users with both don't get double-counted.
 *
 * @param email User email (lowercased)
 * @param workspaceId Internal workspace UUID
 */
export async function checkUserAccess(
  email: string | null,
  workspaceId: string
): Promise<AccessResult> {
  // Priority 1: Check individual subscription by email
  if (email) {
    const userSub = await db.query.userSubscriptions.findFirst({
      where: eq(userSubscriptions.email, email.toLowerCase()),
    });

    if (userSub) {
      // Active or trialing individual subscription grants access
      if (userSub.subscriptionStatus === 'active' || userSub.subscriptionStatus === 'trialing') {
        return {
          hasAccess: true,
          source: 'individual',
          status: userSub.subscriptionStatus as 'active' | 'trialing',
          planId: userSub.planId,
        };
      }
      // past_due still allows access while Stripe retries payment
      if (userSub.subscriptionStatus === 'past_due') {
        return {
          hasAccess: true,
          source: 'individual',
          status: 'active', // Treat past_due as active
          planId: userSub.planId,
        };
      }
      // paused or canceled - continue to check org access as fallback
    }
  }

  // Priority 2: Check organization subscription via workspace
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
  });

  if (workspace?.organizationId) {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, workspace.organizationId),
    });

    if (org) {
      const orgStatus = org.subscriptionStatus;
      if (orgStatus === 'active' || orgStatus === 'trialing') {
        return {
          hasAccess: true,
          source: 'organization',
          status: orgStatus as 'active' | 'trialing',
          planId: org.planId,
        };
      }
      // past_due still allows access while Stripe retries
      if (orgStatus === 'past_due') {
        return {
          hasAccess: true,
          source: 'organization',
          status: 'active', // Treat past_due as active
          planId: org.planId,
        };
      }
      if (orgStatus === 'paused') {
        return { hasAccess: false, reason: 'paused' };
      }
      if (orgStatus === 'canceled') {
        return { hasAccess: false, reason: 'canceled' };
      }
    }
  }

  // Check if individual subscription was paused/canceled (after org check failed)
  if (email) {
    const userSub = await db.query.userSubscriptions.findFirst({
      where: eq(userSubscriptions.email, email.toLowerCase()),
    });

    if (userSub?.subscriptionStatus === 'paused') {
      return { hasAccess: false, reason: 'paused' };
    }
    if (userSub?.subscriptionStatus === 'canceled') {
      return { hasAccess: false, reason: 'canceled' };
    }
  }

  return { hasAccess: false, reason: 'no_subscription' };
}

/**
 * Get individual subscription details for a user
 */
export async function getIndividualSubscription(email: string) {
  if (!email) return null;

  return db.query.userSubscriptions.findFirst({
    where: eq(userSubscriptions.email, email.toLowerCase()),
  });
}

/**
 * Check if user has an active individual subscription
 */
export async function hasIndividualSubscription(email: string): Promise<boolean> {
  const sub = await getIndividualSubscription(email);
  return sub?.subscriptionStatus === 'active' || sub?.subscriptionStatus === 'trialing';
}
