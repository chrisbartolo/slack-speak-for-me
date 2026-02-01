import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';

const { organizations } = schema;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.client.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        await db
          .update(organizations)
          .set({
            stripeSubscriptionId: subscription.id,
            subscriptionStatus: subscription.status,
            seatCount: subscription.items.data[0]?.quantity || 1,
            updatedAt: new Date(),
          })
          .where(eq(organizations.stripeCustomerId, customerId));

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        await db
          .update(organizations)
          .set({
            subscriptionStatus: 'canceled',
            updatedAt: new Date(),
          })
          .where(eq(organizations.stripeCustomerId, customerId));

        break;
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        // Link subscription to organization
        if (session.metadata?.organizationId) {
          await db
            .update(organizations)
            .set({
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              subscriptionStatus: 'active',
              planId: session.metadata.planId || 'pro',
              updatedAt: new Date(),
            })
            .where(eq(organizations.id, session.metadata.organizationId));
        }

        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
