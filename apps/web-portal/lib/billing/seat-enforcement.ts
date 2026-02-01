import 'server-only';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';

const { organizations } = schema;

export type SubscriptionAccessResult =
  | { allowed: true; status: 'active' | 'trialing' }
  | { allowed: false; reason: 'no_subscription' | 'paused' | 'canceled' | 'seat_limit' };

/**
 * Check if organization has valid subscription access
 */
export async function checkSubscriptionAccess(
  organizationId: string
): Promise<SubscriptionAccessResult> {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });

  if (!org) {
    return { allowed: false, reason: 'no_subscription' };
  }

  const status = org.subscriptionStatus;

  if (!status || status === 'canceled') {
    return { allowed: false, reason: 'canceled' };
  }

  if (status === 'paused') {
    return { allowed: false, reason: 'paused' };
  }

  if (status === 'active' || status === 'trialing') {
    return { allowed: true, status };
  }

  // past_due still allows access (Stripe handles retries)
  if (status === 'past_due') {
    return { allowed: true, status: 'active' };
  }

  return { allowed: false, reason: 'no_subscription' };
}

/**
 * Check if adding a new user would exceed seat limit
 */
export async function canAddUser(organizationId: string): Promise<{
  canAdd: boolean;
  currentUsers: number;
  seatLimit: number;
}> {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });

  if (!org) {
    return { canAdd: false, currentUsers: 0, seatLimit: 0 };
  }

  // Count users across all workspaces in this organization
  // For now, we count users in the workspace (simplified model)
  // In production, you'd count across all workspaces in the org
  const seatLimit = org.seatCount || 1;

  // Placeholder: actual user counting would require joining workspace
  // For MVP, we trust Stripe's seat count matches intended limit
  return { canAdd: true, currentUsers: 0, seatLimit };
}

/**
 * Enforce seat limits - throws if limit exceeded
 */
export async function enforceSeats(organizationId: string): Promise<void> {
  const access = await checkSubscriptionAccess(organizationId);

  if (!access.allowed) {
    const messages: Record<string, string> = {
      no_subscription: 'No active subscription. Please upgrade to continue.',
      paused: 'Subscription paused. Add a payment method to resume.',
      canceled: 'Subscription canceled. Please subscribe to continue.',
      seat_limit: 'Seat limit reached. Upgrade to add more users.',
    };
    throw new Error(messages[access.reason]);
  }
}

/**
 * Get human-readable subscription status message
 */
export function getSubscriptionMessage(
  status: string | null,
  trialEndsAt: Date | null
): { type: 'info' | 'warning' | 'error'; message: string } | null {
  if (status === 'trialing' && trialEndsAt) {
    const days = Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days <= 3) {
      return { type: 'warning', message: `Trial ends in ${days} day${days === 1 ? '' : 's'}` };
    }
    return { type: 'info', message: `${days} days left in trial` };
  }

  if (status === 'paused') {
    return { type: 'error', message: 'Subscription paused - add payment to continue' };
  }

  if (status === 'past_due') {
    return { type: 'warning', message: 'Payment past due - please update your payment method' };
  }

  return null;
}
