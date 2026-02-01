import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { sendEmail } from '@/lib/email/resend';
import {
  trialEndingEmail,
  subscriptionPausedEmail,
  paymentFailedEmail,
  subscriptionResumedEmail,
} from '@/lib/email/templates';

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
            trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
            updatedAt: new Date(),
          })
          .where(eq(organizations.stripeCustomerId, customerId));

        console.log(`Subscription ${event.type === 'customer.subscription.created' ? 'created' : 'updated'} for customer ${customerId}, status: ${subscription.status}`);
        break;
      }

      case 'customer.subscription.trial_will_end': {
        // Sent 3 days before trial ends
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Get organization to find billing email
        const trialOrg = await db.query.organizations.findFirst({
          where: eq(organizations.stripeCustomerId, customerId),
        });

        if (trialOrg?.billingEmail) {
          const daysRemaining = subscription.trial_end
            ? Math.ceil((subscription.trial_end * 1000 - Date.now()) / (1000 * 60 * 60 * 24))
            : 3;
          const template = trialEndingEmail(daysRemaining);
          await sendEmail({
            to: trialOrg.billingEmail,
            subject: template.subject,
            html: template.html,
            text: template.text,
          });
          console.log(`Trial ending email sent to ${trialOrg.billingEmail}`);
        }
        break;
      }

      case 'customer.subscription.paused': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Get organization before update to find billing email
        const pausedOrg = await db.query.organizations.findFirst({
          where: eq(organizations.stripeCustomerId, customerId),
        });

        await db
          .update(organizations)
          .set({
            subscriptionStatus: 'paused',
            updatedAt: new Date(),
          })
          .where(eq(organizations.stripeCustomerId, customerId));

        if (pausedOrg?.billingEmail) {
          const template = subscriptionPausedEmail();
          await sendEmail({
            to: pausedOrg.billingEmail,
            subject: template.subject,
            html: template.html,
            text: template.text,
          });
          console.log(`Subscription paused email sent to ${pausedOrg.billingEmail}`);
        }
        break;
      }

      case 'customer.subscription.resumed': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Get organization before update to find billing email
        const resumedOrg = await db.query.organizations.findFirst({
          where: eq(organizations.stripeCustomerId, customerId),
        });

        await db
          .update(organizations)
          .set({
            subscriptionStatus: 'active',
            updatedAt: new Date(),
          })
          .where(eq(organizations.stripeCustomerId, customerId));

        if (resumedOrg?.billingEmail) {
          const template = subscriptionResumedEmail();
          await sendEmail({
            to: resumedOrg.billingEmail,
            subject: template.subject,
            html: template.html,
            text: template.text,
          });
          console.log(`Subscription resumed email sent to ${resumedOrg.billingEmail}`);
        }
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

        console.log(`Checkout completed for customer ${customerId}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        // Get organization to find billing email
        const failedOrg = await db.query.organizations.findFirst({
          where: eq(organizations.stripeCustomerId, customerId),
        });

        if (failedOrg?.billingEmail) {
          const template = paymentFailedEmail(invoice.hosted_invoice_url || undefined);
          await sendEmail({
            to: failedOrg.billingEmail,
            subject: template.subject,
            html: template.html,
            text: template.text,
          });
          console.log(`Payment failed email sent to ${failedOrg.billingEmail}`);
        }

        // Log failure - Stripe handles retry automatically
        console.log(`Payment failed for customer ${customerId}, invoice ${invoice.id}`);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        // Ensure status is active after successful payment
        await db
          .update(organizations)
          .set({
            subscriptionStatus: 'active',
            updatedAt: new Date(),
          })
          .where(eq(organizations.stripeCustomerId, customerId));

        console.log(`Invoice paid for customer ${customerId}, invoice ${invoice.id}`);
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
