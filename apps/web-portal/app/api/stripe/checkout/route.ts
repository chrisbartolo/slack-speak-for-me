import { NextResponse } from 'next/server';
import { requireAdmin, getOrganization } from '@/lib/auth/admin';
import { getOptionalSession } from '@/lib/auth/dal';
import { getStripe, createCustomer, createTrialCheckout, createIndividualCheckout } from '@/lib/stripe';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { validateCoupon, applyCouponToCheckout } from '@/lib/billing/coupons';
import { getRefereeDiscount, recordReferralSignup } from '@/lib/billing/referrals';

const { organizations, userSubscriptions } = schema;

// Map plan IDs to environment variable names for price IDs
const PLAN_PRICE_IDS: Record<string, string | undefined> = {
  starter: process.env.STRIPE_PRICE_ID_STARTER,
  pro: process.env.STRIPE_PRICE_ID_PRO,
  individual_starter: process.env.STRIPE_PRICE_ID_INDIVIDUAL_STARTER,
  individual_pro: process.env.STRIPE_PRICE_ID_INDIVIDUAL_PRO,
};

/**
 * Resolve discount from coupon code or referral code
 * Returns Stripe coupon ID and metadata for tracking
 */
async function resolveDiscount(
  email: string,
  planId: string,
  couponCode?: string,
  referralCode?: string
): Promise<{
  stripeCouponId?: string;
  couponId?: string;
  referralCode?: string;
}> {
  // Coupon takes priority over referral discount
  if (couponCode) {
    const validation = await validateCoupon(couponCode, email, planId);
    if (validation.valid && validation.coupon) {
      const stripeCouponId = await applyCouponToCheckout(validation.coupon.id);
      if (stripeCouponId) {
        return { stripeCouponId, couponId: validation.coupon.id };
      }
    }
  }

  // Check referral discount
  if (referralCode) {
    // Record the referral signup if not already recorded
    await recordReferralSignup(referralCode, email);

    const refereeDiscount = await getRefereeDiscount(email);
    if (refereeDiscount.hasDiscount) {
      // Create or get a Stripe coupon for the referral discount
      const stripe = getStripe();
      const refCouponId = `referral_${refereeDiscount.discountPercent}pct`;
      try {
        await stripe.coupons.retrieve(refCouponId);
      } catch {
        await stripe.coupons.create({
          id: refCouponId,
          percent_off: refereeDiscount.discountPercent,
          duration: 'once',
          name: `Referral ${refereeDiscount.discountPercent}% off`,
        });
      }
      return { stripeCouponId: refCouponId, referralCode };
    }
  }

  return {};
}

/**
 * Handle individual user checkout
 * Any authenticated user can start an individual subscription
 */
async function handleIndividualCheckout(body: { planId?: string; couponCode?: string; referralCode?: string }): Promise<Response> {
  const session = await getOptionalSession();

  if (!session) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  if (!session.email) {
    return NextResponse.json(
      { error: 'Email not found in session. Please re-login with email scope.' },
      { status: 400 }
    );
  }

  const planId = body.planId || 'individual_pro';

  // Get price ID for individual plan
  let priceId = PLAN_PRICE_IDS[planId];

  // Fallback for individual plans without specific price IDs
  if (!priceId && planId.startsWith('individual_')) {
    const basePlan = planId.replace('individual_', '');
    priceId = PLAN_PRICE_IDS[basePlan];
  }

  if (!priceId) {
    return NextResponse.json({
      error: `No price configured for plan '${planId}'. Set STRIPE_PRICE_ID_${planId.toUpperCase()} environment variable.`
    }, { status: 400 });
  }

  // Check for existing individual subscription
  const existingSubscription = await db.query.userSubscriptions.findFirst({
    where: eq(userSubscriptions.email, session.email.toLowerCase()),
  });

  if (existingSubscription?.stripeSubscriptionId &&
      existingSubscription.subscriptionStatus === 'active') {
    return NextResponse.json({
      error: 'You already have an active individual subscription.'
    }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://speakforme.app';

  // Resolve coupon or referral discount
  const discount = await resolveDiscount(
    session.email.toLowerCase(),
    planId,
    body.couponCode,
    body.referralCode
  );

  const checkoutSession = await createIndividualCheckout({
    email: session.email.toLowerCase(),
    priceId,
    planId,
    successUrl: `${baseUrl}/dashboard?success=true&subscription=individual`,
    cancelUrl: `${baseUrl}/dashboard?canceled=true`,
    stripeCouponId: discount.stripeCouponId,
    couponId: discount.couponId,
    referralCode: discount.referralCode,
  });

  return NextResponse.json({ url: checkoutSession.url });
}

/**
 * Handle organization checkout
 * Requires admin role in the organization
 */
async function handleOrganizationCheckout(body: { planId?: string; startTrial?: boolean; couponCode?: string; referralCode?: string }): Promise<Response> {
  const stripe = getStripe();
  const session = await requireAdmin();

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

  const planId: string = body.planId || 'pro';
  const startTrial: boolean = body.startTrial ?? !org.stripeSubscriptionId;

  // Get price ID based on planId
  let priceId = PLAN_PRICE_IDS[planId];

  // Fallback to legacy STRIPE_PRICE_ID for backward compatibility
  if (!priceId) {
    priceId = process.env.STRIPE_PRICE_ID;
  }

  if (!priceId) {
    return NextResponse.json({
      error: `No price configured for plan '${planId}'. Set STRIPE_PRICE_ID_${planId.toUpperCase()} environment variable.`
    }, { status: 400 });
  }

  // Get base URL - fallback to production URL if env not set
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://speakforme.app';
  const quantity = org.seatCount || 1;

  // Determine success URL based on whether this is a trial
  const successUrl = startTrial
    ? `${baseUrl}/admin/billing?success=true&trial_started=true`
    : `${baseUrl}/admin/billing?success=true`;

  // Resolve coupon or referral discount
  const billingEmail = org.billingEmail || `billing@${org.slug}.example.com`;
  const discount = await resolveDiscount(
    billingEmail,
    planId,
    body.couponCode,
    body.referralCode
  );

  const discountMetadata = {
    ...(discount.couponId ? { couponId: discount.couponId } : {}),
    ...(discount.referralCode ? { referralCode: discount.referralCode } : {}),
  };

  let checkoutSession;

  if (startTrial) {
    // Create trial checkout - no payment required upfront
    checkoutSession = await createTrialCheckout({
      customerId,
      priceId,
      quantity,
      organizationId: org.id,
      planId,
      successUrl,
      cancelUrl: `${baseUrl}/admin/billing?canceled=true`,
      stripeCouponId: discount.stripeCouponId,
      extraMetadata: discountMetadata,
    });
  } else {
    // Create immediate checkout for upgrades or users who want to pay now
    checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity }],
      ...(discount.stripeCouponId ? { discounts: [{ coupon: discount.stripeCouponId }] } : {}),
      success_url: successUrl,
      cancel_url: `${baseUrl}/admin/billing?canceled=true`,
      metadata: {
        organizationId: org.id,
        planId,
        type: 'organization',
        ...discountMetadata,
      },
      subscription_data: {
        metadata: {
          organizationId: org.id,
          planId,
          type: 'organization',
        },
      },
    });
  }

  return NextResponse.json({ url: checkoutSession.url });
}

export async function POST(request: Request) {
  try {
    // Parse request body
    const body = await request.json().catch(() => ({}));
    const mode: 'individual' | 'organization' = body.mode || 'organization';

    if (mode === 'individual') {
      return handleIndividualCheckout(body);
    } else {
      return handleOrganizationCheckout(body);
    }
  } catch (error) {
    console.error('Checkout session error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
