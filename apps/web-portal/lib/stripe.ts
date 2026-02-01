import 'server-only';
import Stripe from 'stripe';

// Lazy initialization to avoid build-time errors
let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is required');
    }
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-01-28.clover',
      typescript: true,
    });
  }
  return stripeClient;
}

// Export stripe getter for direct access if needed
export const stripe = {
  get client() {
    return getStripe();
  },
};

/**
 * Create Stripe Customer Portal session
 */
export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  return getStripe().billingPortal.sessions.create({
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
    return await getStripe().subscriptions.retrieve(subscriptionId);
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
  return getStripe().subscriptions.update(subscriptionId, {
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
  return getStripe().customers.create({
    email,
    name,
    metadata,
  });
}
