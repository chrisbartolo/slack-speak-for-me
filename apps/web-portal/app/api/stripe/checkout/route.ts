import { NextResponse } from 'next/server';
import { requireAdmin, getOrganization } from '@/lib/auth/admin';
import { getStripe, createCustomer } from '@/lib/stripe';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';

const { organizations } = schema;

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const stripe = getStripe();

    if (!session.organizationId) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    const org = await getOrganization(session.organizationId);
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Get or create Stripe customer
    let customerId = org.stripeCustomerId;

    if (!customerId) {
      const customer = await createCustomer(
        org.billingEmail || `billing@${org.slug}.example.com`,
        org.name,
        { organizationId: org.id }
      );
      customerId = customer.id;

      // Save customer ID
      await db
        .update(organizations)
        .set({ stripeCustomerId: customerId, updatedAt: new Date() })
        .where(eq(organizations.id, org.id));
    }

    // Get price ID from environment or request
    const body = await request.json().catch(() => ({}));
    const priceId = body.priceId || process.env.STRIPE_PRICE_ID;

    if (!priceId) {
      return NextResponse.json({
        error: 'No price configured. Set STRIPE_PRICE_ID environment variable or create a price in Stripe Dashboard.'
      }, { status: 400 });
    }

    // Get base URL - fallback to production URL if env not set
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://speakforme.app';

    // Create Checkout Session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: org.seatCount || 1,
        },
      ],
      success_url: `${baseUrl}/admin/billing?success=true`,
      cancel_url: `${baseUrl}/admin/billing?canceled=true`,
      metadata: {
        organizationId: org.id,
        planId: 'pro',
      },
      subscription_data: {
        metadata: {
          organizationId: org.id,
        },
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('Checkout session error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
