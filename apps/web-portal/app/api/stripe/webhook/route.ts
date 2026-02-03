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
import { recordCouponRedemption } from '@/lib/billing/coupons';
import { recordReferralSubscription } from '@/lib/billing/referrals';

const { organizations, userSubscriptions } = schema;

/**
 * Determine if subscription is individual or organization based on metadata
 */
function getSubscriptionType(metadata: Stripe.Metadata | null | undefined): 'individual' | 'organization' {
  return metadata?.type === 'individual' ? 'individual' : 'organization';
}

/**
 * Handle subscription created/updated for individual users
 */
async function handleIndividualSubscriptionUpdate(subscription: Stripe.Subscription) {
  const email = subscription.metadata?.email?.toLowerCase();
  if (!email) {
    console.error('Individual subscription missing email in metadata');
    return;
  }

  const customerId = subscription.customer as string;

  // Upsert user subscription
  await db
    .insert(userSubscriptions)
    .values({
      email,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      planId: subscription.metadata?.planId || 'individual_pro',
      trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userSubscriptions.email,
      set: {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        planId: subscription.metadata?.planId || 'individual_pro',
        trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        updatedAt: new Date(),
      },
    });

  console.log(`Individual subscription updated for ${email}, status: ${subscription.status}`);
}

/**
 * Handle subscription created/updated for organizations
 */
async function handleOrganizationSubscriptionUpdate(subscription: Stripe.Subscription) {
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

  console.log(`Organization subscription updated for customer ${customerId}, status: ${subscription.status}`);
}

/**
 * Handle subscription pause for individual users
 */
async function handleIndividualSubscriptionPaused(subscription: Stripe.Subscription) {
  const email = subscription.metadata?.email?.toLowerCase();
  if (!email) return;

  await db
    .update(userSubscriptions)
    .set({ subscriptionStatus: 'paused', updatedAt: new Date() })
    .where(eq(userSubscriptions.email, email));

  // Send email notification
  const template = subscriptionPausedEmail();
  await sendEmail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });

  console.log(`Individual subscription paused for ${email}`);
}

/**
 * Handle subscription resume for individual users
 */
async function handleIndividualSubscriptionResumed(subscription: Stripe.Subscription) {
  const email = subscription.metadata?.email?.toLowerCase();
  if (!email) return;

  await db
    .update(userSubscriptions)
    .set({ subscriptionStatus: 'active', updatedAt: new Date() })
    .where(eq(userSubscriptions.email, email));

  // Send email notification
  const template = subscriptionResumedEmail();
  await sendEmail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });

  console.log(`Individual subscription resumed for ${email}`);
}

/**
 * Handle subscription deleted for individual users
 */
async function handleIndividualSubscriptionDeleted(subscription: Stripe.Subscription) {
  const email = subscription.metadata?.email?.toLowerCase();
  if (!email) return;

  await db
    .update(userSubscriptions)
    .set({ subscriptionStatus: 'canceled', updatedAt: new Date() })
    .where(eq(userSubscriptions.email, email));

  console.log(`Individual subscription canceled for ${email}`);
}

/**
 * Handle checkout completed for individual users
 */
async function handleIndividualCheckoutCompleted(session: Stripe.Checkout.Session) {
  const email = session.metadata?.email?.toLowerCase() || session.customer_email?.toLowerCase();
  if (!email) {
    console.error('Individual checkout completed without email');
    return;
  }

  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  // Create or update user subscription
  await db
    .insert(userSubscriptions)
    .values({
      email,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      subscriptionStatus: 'active',
      planId: session.metadata?.planId || 'individual_pro',
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userSubscriptions.email,
      set: {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        subscriptionStatus: 'active',
        planId: session.metadata?.planId || 'individual_pro',
        updatedAt: new Date(),
      },
    });

  console.log(`Individual checkout completed for ${email}`);
}

/**
 * Handle trial ending notification for individual users
 */
async function handleIndividualTrialWillEnd(subscription: Stripe.Subscription) {
  const email = subscription.metadata?.email?.toLowerCase();
  if (!email) return;

  const daysRemaining = subscription.trial_end
    ? Math.ceil((subscription.trial_end * 1000 - Date.now()) / (1000 * 60 * 60 * 24))
    : 3;

  const template = trialEndingEmail(daysRemaining);
  await sendEmail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });

  console.log(`Individual trial ending email sent to ${email}`);
}

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
        const type = getSubscriptionType(subscription.metadata);

        if (type === 'individual') {
          await handleIndividualSubscriptionUpdate(subscription);
        } else {
          await handleOrganizationSubscriptionUpdate(subscription);
        }
        break;
      }

      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object as Stripe.Subscription;
        const type = getSubscriptionType(subscription.metadata);
        const customerId = subscription.customer as string;

        if (type === 'individual') {
          await handleIndividualTrialWillEnd(subscription);
        } else {
          // Organization trial ending
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
        }
        break;
      }

      case 'customer.subscription.paused': {
        const subscription = event.data.object as Stripe.Subscription;
        const type = getSubscriptionType(subscription.metadata);
        const customerId = subscription.customer as string;

        if (type === 'individual') {
          await handleIndividualSubscriptionPaused(subscription);
        } else {
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
        }
        break;
      }

      case 'customer.subscription.resumed': {
        const subscription = event.data.object as Stripe.Subscription;
        const type = getSubscriptionType(subscription.metadata);
        const customerId = subscription.customer as string;

        if (type === 'individual') {
          await handleIndividualSubscriptionResumed(subscription);
        } else {
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
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const type = getSubscriptionType(subscription.metadata);
        const customerId = subscription.customer as string;

        if (type === 'individual') {
          await handleIndividualSubscriptionDeleted(subscription);
        } else {
          await db
            .update(organizations)
            .set({
              subscriptionStatus: 'canceled',
              updatedAt: new Date(),
            })
            .where(eq(organizations.stripeCustomerId, customerId));
        }
        break;
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const type = getSubscriptionType(session.metadata);
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (type === 'individual') {
          await handleIndividualCheckoutCompleted(session);
        } else if (session.metadata?.organizationId) {
          // Link subscription to organization
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

          console.log(`Organization checkout completed for customer ${customerId}`);
        }

        // Track coupon redemption if applicable
        if (session.metadata?.couponId) {
          const checkoutEmail = session.metadata?.email || session.customer_email || '';
          const orgId = session.metadata?.organizationId || null;
          const discountAmount = session.total_details?.amount_discount || 0;
          try {
            await recordCouponRedemption(
              session.metadata.couponId,
              checkoutEmail,
              orgId,
              discountAmount
            );
            console.log(`Coupon ${session.metadata.couponId} redeemed by ${checkoutEmail}`);
          } catch (err) {
            console.error('Failed to record coupon redemption:', err);
          }
        }

        // Track referral conversion if applicable
        if (session.metadata?.referralCode) {
          const refereeEmail = session.metadata?.email || session.customer_email || '';
          if (refereeEmail) {
            try {
              await recordReferralSubscription(refereeEmail);
              console.log(`Referral conversion recorded for ${refereeEmail}`);
            } catch (err) {
              console.error('Failed to record referral subscription:', err);
            }
          }
        }

        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        // Invoice doesn't have subscription metadata directly, check both tables
        const invoiceUrl = invoice.hosted_invoice_url || undefined;

        // Check organization first
        const failedOrg = await db.query.organizations.findFirst({
          where: eq(organizations.stripeCustomerId, customerId),
        });

        if (failedOrg?.billingEmail) {
          const template = paymentFailedEmail(invoiceUrl);
          await sendEmail({
            to: failedOrg.billingEmail,
            subject: template.subject,
            html: template.html,
            text: template.text,
          });
          console.log(`Payment failed email sent to ${failedOrg.billingEmail}`);
        } else {
          // Check individual user
          const failedUser = await db.query.userSubscriptions.findFirst({
            where: eq(userSubscriptions.stripeCustomerId, customerId),
          });

          if (failedUser?.email) {
            const template = paymentFailedEmail(invoiceUrl);
            await sendEmail({
              to: failedUser.email,
              subject: template.subject,
              html: template.html,
              text: template.text,
            });
            console.log(`Payment failed email sent to ${failedUser.email}`);
          }
        }

        console.log(`Payment failed for customer ${customerId}, invoice ${invoice.id}`);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        // Update organization if exists
        const orgUpdateResult = await db
          .update(organizations)
          .set({
            subscriptionStatus: 'active',
            updatedAt: new Date(),
          })
          .where(eq(organizations.stripeCustomerId, customerId));

        // If no organization updated, try individual
        if (!orgUpdateResult) {
          await db
            .update(userSubscriptions)
            .set({
              subscriptionStatus: 'active',
              updatedAt: new Date(),
            })
            .where(eq(userSubscriptions.stripeCustomerId, customerId));
        }

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
