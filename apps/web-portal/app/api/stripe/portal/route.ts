import { NextResponse } from 'next/server';
import { requireAdmin, getOrganization } from '@/lib/auth/admin';
import { createPortalSession } from '@/lib/stripe';

export async function POST() {
  try {
    const session = await requireAdmin();

    if (!session.organizationId) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    const org = await getOrganization(session.organizationId);

    if (!org?.stripeCustomerId) {
      return NextResponse.json({ error: 'No Stripe customer' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://speakforme.app';
    const portalSession = await createPortalSession(
      org.stripeCustomerId,
      `${baseUrl}/admin/billing`
    );

    return NextResponse.redirect(portalSession.url);
  } catch (error) {
    console.error('Portal session error:', error);
    return NextResponse.json({ error: 'Failed to create portal session' }, { status: 500 });
  }
}
