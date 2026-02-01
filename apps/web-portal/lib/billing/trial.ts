import 'server-only';

interface TrialStatus {
  isInTrial: boolean;
  daysRemaining: number | null;
  trialEndsAt: Date | null;
  hasExpired: boolean;
}

export function getTrialStatus(
  subscriptionStatus: string | null,
  trialEndsAt: Date | null
): TrialStatus {
  if (!trialEndsAt) {
    return { isInTrial: false, daysRemaining: null, trialEndsAt: null, hasExpired: false };
  }

  const now = new Date();
  const isInTrial = subscriptionStatus === 'trialing';
  const hasExpired = trialEndsAt < now && !isInTrial;
  const daysRemaining = isInTrial
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  return { isInTrial, daysRemaining, trialEndsAt, hasExpired };
}

export function isTrialExpired(
  subscriptionStatus: string | null,
  trialEndsAt: Date | null
): boolean {
  if (!trialEndsAt) return false;
  return subscriptionStatus === 'paused' || (trialEndsAt < new Date() && subscriptionStatus !== 'active');
}

export function formatTrialDaysRemaining(days: number): string {
  if (days === 0) return 'Trial ends today';
  if (days === 1) return '1 day left in trial';
  return `${days} days left in trial`;
}
