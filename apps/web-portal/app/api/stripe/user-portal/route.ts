import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth/dal';
import { createPortalSession } from '@/lib/stripe';
import { getIndividualSubscription } from '@/lib/billing/access-check';

/**
 * POST /api/stripe/user-portal
 *
 * Creates a Stripe Customer Portal session for individual subscriptions.
 * Unlike /api/stripe/portal (org admin), this uses the user's email to find
 * their individual subscription customer.
 */
export async function POST() {
  try {
    const session = await verifySession();

    if (!session.email) {
      return NextResponse.json(
        { error: 'Email required for individual billing' },
        { status: 400 }
      );
    }

    const userSub = await getIndividualSubscription(session.email);

    if (!userSub?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No individual subscription found' },
        { status: 404 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://speakforme.app';

    const portalSession = await createPortalSession(
      userSub.stripeCustomerId,
      `${baseUrl}/settings/billing`
    );

    return NextResponse.redirect(portalSession.url);
  } catch (error) {
    console.error('User portal error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create portal session' },
      { status: 500 }
    );
  }
}
