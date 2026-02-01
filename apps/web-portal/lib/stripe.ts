import 'server-only';
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is required');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-01-28.clover',
  typescript: true,
});

/**
 * Create Stripe Customer Portal session
 */
export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

/**
 * Get customer's active subscription
 */
export async function getSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription | null> {
  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch {
    return null;
  }
}

/**
 * Update subscription quantity (seats)
 */
export async function updateSeats(
  subscriptionId: string,
  subscriptionItemId: string,
  quantity: number
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.update(subscriptionId, {
    items: [{
      id: subscriptionItemId,
      quantity,
    }],
    proration_behavior: 'create_prorations',
  });
}

/**
 * Create Stripe customer for organization
 */
export async function createCustomer(
  email: string,
  name: string,
  metadata: Record<string, string>
): Promise<Stripe.Customer> {
  return stripe.customers.create({
    email,
    name,
    metadata,
  });
}
