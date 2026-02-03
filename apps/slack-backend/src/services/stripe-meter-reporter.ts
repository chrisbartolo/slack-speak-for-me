import Stripe from 'stripe';
import { db, usageEvents, userSubscriptions, users, workspaces, organizations } from '@slack-speak/database';
import { eq, and, isNull, sql, gt } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

// Lazy-initialized Stripe client
let stripeClient: Stripe | null = null;

function getStripeClient(): Stripe | null {
  if (stripeClient) {
    return stripeClient;
  }

  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    logger.warn('STRIPE_SECRET_KEY not configured - Stripe usage reporting disabled');
    return null;
  }

  stripeClient = new Stripe(apiKey, {
    apiVersion: '2026-01-28.clover',
  });

  return stripeClient;
}

// Meter event name from environment or default
const METER_EVENT_NAME = process.env.STRIPE_METER_EVENT_NAME || 'ai_suggestion';

interface StripeUsageReport {
  stripeCustomerId: string;
  eventId: string; // usageEvents.id for idempotency
  workspaceId: string;
  userId: string;
  value?: number; // defaults to 1
}

/**
 * Report a single usage event to Stripe Billing Meters
 */
export async function reportUsageToStripe(params: StripeUsageReport): Promise<boolean> {
  const { stripeCustomerId, eventId, workspaceId, userId, value = 1 } = params;

  const stripe = getStripeClient();
  if (!stripe) {
    logger.debug('Stripe not configured - skipping usage report');
    return false;
  }

  try {
    // Create idempotency identifier
    const identifier = `${workspaceId}-${userId}-${eventId}`;

    // Report to Stripe Billing Meters
    await stripe.billing.meterEvents.create({
      event_name: METER_EVENT_NAME,
      payload: {
        stripe_customer_id: stripeCustomerId,
        value: value.toString(),
      },
      identifier,
    });

    logger.info({
      stripeCustomerId,
      eventId,
      identifier,
      value,
    }, 'Usage event reported to Stripe');

    return true;
  } catch (error: any) {
    // Handle idempotent case - resource already exists is success
    if (error?.code === 'resource_already_exists') {
      logger.debug({
        eventId,
        identifier: `${workspaceId}-${userId}-${eventId}`,
      }, 'Usage event already reported (idempotent)');
      return true;
    }

    logger.error({
      error: error?.message || error,
      stripeCustomerId,
      eventId,
    }, 'Failed to report usage to Stripe');

    return false;
  }
}

interface BatchReportSummary {
  total: number;
  reported: number;
  skipped: number;
  failed: number;
}

/**
 * Find and report all unreported usage events from the past 35 days
 * Dual-path customer ID resolution: individual subscription first, then organization
 */
export async function reportUnreportedUsageBatch(): Promise<BatchReportSummary> {
  const stripe = getStripeClient();
  if (!stripe) {
    logger.warn('Stripe not configured - skipping batch usage report');
    return { total: 0, reported: 0, skipped: 0, failed: 0 };
  }

  const summary: BatchReportSummary = {
    total: 0,
    reported: 0,
    skipped: 0,
    failed: 0,
  };

  try {
    // Stripe's max lookback is 35 days
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - 35);

    // Find unreported events from the past 35 days (limit to 500 per batch)
    const unreportedEvents = await db
      .select()
      .from(usageEvents)
      .where(
        and(
          isNull(usageEvents.stripeReportedAt),
          gt(usageEvents.createdAt, lookbackDate)
        )
      )
      .limit(500);

    summary.total = unreportedEvents.length;

    logger.info({ count: summary.total }, 'Found unreported usage events');

    if (unreportedEvents.length === 0) {
      return summary;
    }

    // Process each event
    for (const event of unreportedEvents) {
      try {
        // Dual-path customer ID lookup
        let stripeCustomerId: string | null = null;

        // Path 1: Individual subscription by email
        if (event.email) {
          const [individualSub] = await db
            .select({ stripeCustomerId: userSubscriptions.stripeCustomerId })
            .from(userSubscriptions)
            .where(eq(userSubscriptions.email, event.email))
            .limit(1);

          if (individualSub?.stripeCustomerId) {
            stripeCustomerId = individualSub.stripeCustomerId;
            logger.debug({
              eventId: event.id,
              email: event.email,
              stripeCustomerId,
            }, 'Found Stripe customer via individual subscription');
          }
        }

        // Path 2: Organization subscription (fallback)
        if (!stripeCustomerId && event.workspaceId) {
          const [orgSub] = await db
            .select({
              organizationId: workspaces.organizationId,
              orgStripeCustomerId: organizations.stripeCustomerId,
            })
            .from(workspaces)
            .leftJoin(organizations, eq(workspaces.organizationId, organizations.id))
            .where(eq(workspaces.id, event.workspaceId))
            .limit(1);

          if (orgSub?.orgStripeCustomerId) {
            stripeCustomerId = orgSub.orgStripeCustomerId;
            logger.debug({
              eventId: event.id,
              workspaceId: event.workspaceId,
              stripeCustomerId,
            }, 'Found Stripe customer via organization');
          }
        }

        // Skip if no customer found (free tier user)
        if (!stripeCustomerId) {
          logger.debug({
            eventId: event.id,
            email: event.email,
            workspaceId: event.workspaceId,
          }, 'No Stripe customer found - skipping (likely free tier)');
          summary.skipped++;
          continue;
        }

        // Report to Stripe
        const success = await reportUsageToStripe({
          stripeCustomerId,
          eventId: event.id,
          workspaceId: event.workspaceId || 'unknown',
          userId: event.slackUserId,
          value: 1,
        });

        if (success) {
          // Mark as reported
          await db
            .update(usageEvents)
            .set({ stripeReportedAt: new Date() })
            .where(eq(usageEvents.id, event.id));

          summary.reported++;
        } else {
          summary.failed++;
        }
      } catch (eventError: any) {
        logger.error({
          error: eventError?.message || eventError,
          eventId: event.id,
        }, 'Error processing individual usage event');
        summary.failed++;
      }
    }

    logger.info({
      ...summary,
    }, 'Batch usage reporting complete');

    return summary;
  } catch (error: any) {
    logger.error({
      error: error?.message || error,
    }, 'Failed to run batch usage report');
    return summary;
  }
}
