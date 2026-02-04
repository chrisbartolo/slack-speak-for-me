import { db, suggestionMetrics, workspaces } from '@slack-speak/database';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

// Cache for organizationId lookups (5-minute TTL)
const orgCache = new Map<string, { orgId: string | null; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Generate a unique suggestion ID
 * Format: sug_{timestamp}_{random}
 */
export function generateSuggestionId(): string {
  return `sug_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Internal helper to resolve organizationId from workspaceId with caching
 */
async function resolveOrganizationId(workspaceId: string): Promise<string | null> {
  const cached = orgCache.get(workspaceId);
  if (cached && cached.expiry > Date.now()) {
    return cached.orgId;
  }

  try {
    const [ws] = await db
      .select({ organizationId: workspaces.organizationId })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    const orgId = ws?.organizationId ?? null;
    orgCache.set(workspaceId, { orgId, expiry: Date.now() + CACHE_TTL });
    return orgId;
  } catch (error) {
    logger.warn({ error, workspaceId }, 'Failed to resolve organizationId - caching null');
    orgCache.set(workspaceId, { orgId: null, expiry: Date.now() + CACHE_TTL });
    return null;
  }
}

/**
 * Record initial event reception
 * Creates the initial metrics record with eventReceivedAt timestamp
 */
export async function recordEventReceived(params: {
  suggestionId: string;
  workspaceId: string;
  userId: string;
  channelId?: string;
  triggerType?: string;
}): Promise<void> {
  try {
    const organizationId = await resolveOrganizationId(params.workspaceId);
    const eventReceivedAt = new Date();

    await db
      .insert(suggestionMetrics)
      .values({
        suggestionId: params.suggestionId,
        workspaceId: params.workspaceId,
        organizationId,
        userId: params.userId,
        channelId: params.channelId,
        triggerType: params.triggerType,
        eventReceivedAt,
      })
      .onConflictDoUpdate({
        target: [suggestionMetrics.suggestionId],
        set: {
          eventReceivedAt,
          channelId: params.channelId,
          triggerType: params.triggerType,
        },
      });
  } catch (error) {
    logger.warn({ error, suggestionId: params.suggestionId }, 'Failed to record event received - non-fatal');
  }
}

/**
 * Record job queuing timestamp
 */
export async function recordJobQueued(params: {
  suggestionId: string;
  jobQueuedAt?: Date;
}): Promise<void> {
  try {
    const jobQueuedAt = params.jobQueuedAt ?? new Date();

    await db
      .insert(suggestionMetrics)
      .values({
        suggestionId: params.suggestionId,
        workspaceId: '00000000-0000-0000-0000-000000000000', // Placeholder for insert
        userId: '',
        jobQueuedAt,
      })
      .onConflictDoUpdate({
        target: [suggestionMetrics.suggestionId],
        set: { jobQueuedAt },
      });
  } catch (error) {
    logger.warn({ error, suggestionId: params.suggestionId }, 'Failed to record job queued - non-fatal');
  }
}

/**
 * Record AI processing start timestamp
 */
export async function recordAIStarted(params: {
  suggestionId: string;
}): Promise<void> {
  try {
    const aiStartedAt = new Date();

    await db
      .insert(suggestionMetrics)
      .values({
        suggestionId: params.suggestionId,
        workspaceId: '00000000-0000-0000-0000-000000000000', // Placeholder for insert
        userId: '',
        aiStartedAt,
      })
      .onConflictDoUpdate({
        target: [suggestionMetrics.suggestionId],
        set: { aiStartedAt },
      });
  } catch (error) {
    logger.warn({ error, suggestionId: params.suggestionId }, 'Failed to record AI started - non-fatal');
  }
}

/**
 * Record AI processing completion timestamp
 * Computes aiProcessingMs if aiStartedAt is available
 */
export async function recordAICompleted(params: {
  suggestionId: string;
  aiProcessingMs?: number;
}): Promise<void> {
  try {
    const aiCompletedAt = new Date();
    let aiProcessingMs = params.aiProcessingMs;

    // If not provided, try to compute from existing record
    if (aiProcessingMs === undefined) {
      const [existing] = await db
        .select({ aiStartedAt: suggestionMetrics.aiStartedAt })
        .from(suggestionMetrics)
        .where(eq(suggestionMetrics.suggestionId, params.suggestionId))
        .limit(1);

      if (existing?.aiStartedAt) {
        aiProcessingMs = aiCompletedAt.getTime() - existing.aiStartedAt.getTime();
      }
    }

    await db
      .insert(suggestionMetrics)
      .values({
        suggestionId: params.suggestionId,
        workspaceId: '00000000-0000-0000-0000-000000000000', // Placeholder for insert
        userId: '',
        aiCompletedAt,
        aiProcessingMs,
      })
      .onConflictDoUpdate({
        target: [suggestionMetrics.suggestionId],
        set: {
          aiCompletedAt,
          aiProcessingMs,
        },
      });
  } catch (error) {
    logger.warn({ error, suggestionId: params.suggestionId }, 'Failed to record AI completed - non-fatal');
  }
}

/**
 * Record delivery timestamp
 * Computes totalDurationMs and queueDelayMs from existing timestamps
 */
export async function recordDelivered(params: {
  suggestionId: string;
}): Promise<void> {
  try {
    const deliveredAt = new Date();
    let totalDurationMs: number | undefined;
    let queueDelayMs: number | undefined;

    // Fetch existing timestamps to compute durations
    const [existing] = await db
      .select({
        eventReceivedAt: suggestionMetrics.eventReceivedAt,
        jobQueuedAt: suggestionMetrics.jobQueuedAt,
        aiStartedAt: suggestionMetrics.aiStartedAt,
      })
      .from(suggestionMetrics)
      .where(eq(suggestionMetrics.suggestionId, params.suggestionId))
      .limit(1);

    if (existing) {
      if (existing.eventReceivedAt) {
        totalDurationMs = deliveredAt.getTime() - existing.eventReceivedAt.getTime();
      }
      if (existing.jobQueuedAt && existing.aiStartedAt) {
        queueDelayMs = existing.aiStartedAt.getTime() - existing.jobQueuedAt.getTime();
      }
    }

    await db
      .insert(suggestionMetrics)
      .values({
        suggestionId: params.suggestionId,
        workspaceId: '00000000-0000-0000-0000-000000000000', // Placeholder for insert
        userId: '',
        deliveredAt,
        totalDurationMs,
        queueDelayMs,
      })
      .onConflictDoUpdate({
        target: [suggestionMetrics.suggestionId],
        set: {
          deliveredAt,
          totalDurationMs,
          queueDelayMs,
        },
      });
  } catch (error) {
    logger.warn({ error, suggestionId: params.suggestionId }, 'Failed to record delivered - non-fatal');
  }
}

/**
 * Record user action (accepted, refined, dismissed, sent, liked, disliked)
 */
export async function recordUserAction(params: {
  suggestionId: string;
  action: 'accepted' | 'refined' | 'dismissed' | 'sent' | 'liked' | 'disliked';
}): Promise<void> {
  try {
    const userActionAt = new Date();

    await db
      .insert(suggestionMetrics)
      .values({
        suggestionId: params.suggestionId,
        workspaceId: '00000000-0000-0000-0000-000000000000', // Placeholder for insert
        userId: '',
        userAction: params.action,
        userActionAt,
      })
      .onConflictDoUpdate({
        target: [suggestionMetrics.suggestionId],
        set: {
          userAction: params.action,
          userActionAt,
        },
      });
  } catch (error) {
    logger.warn({ error, suggestionId: params.suggestionId }, 'Failed to record user action - non-fatal');
  }
}

/**
 * Record error during suggestion pipeline
 */
export async function recordError(params: {
  suggestionId: string;
  errorType: 'usage_limit' | 'guardrail' | 'ai_error' | 'delivery_error';
}): Promise<void> {
  try {
    await db
      .insert(suggestionMetrics)
      .values({
        suggestionId: params.suggestionId,
        workspaceId: '00000000-0000-0000-0000-000000000000', // Placeholder for insert
        userId: '',
        errorType: params.errorType,
      })
      .onConflictDoUpdate({
        target: [suggestionMetrics.suggestionId],
        set: {
          errorType: params.errorType,
        },
      });
  } catch (error) {
    logger.warn({ error, suggestionId: params.suggestionId }, 'Failed to record error - non-fatal');
  }
}
