import { db, actionableItems, type ActionableStatus, type NewActionableItem } from '@slack-speak/database';
import { eq, and, desc, gte, or, lt, sql } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { detectActionable, type ActionableDetectionContext } from './actionable-detection.js';

/**
 * Process a message for actionable items
 * Detects and stores actionable if found
 */
export async function processMessageForActionables(params: {
  workspaceId: string;
  userId: string;
  channelId: string;
  messageTs: string;
  threadTs?: string;
  messageText: string;
  messageAuthorId: string;
  threadContext?: string;
}): Promise<void> {
  const {
    workspaceId,
    userId,
    channelId,
    messageTs,
    threadTs,
    messageText,
    messageAuthorId,
    threadContext,
  } = params;

  // Skip if message is too short to contain actionable
  if (messageText.length < 10) {
    return;
  }

  // Check for existing actionable from this message
  const existing = await db
    .select({ id: actionableItems.id })
    .from(actionableItems)
    .where(
      and(
        eq(actionableItems.workspaceId, workspaceId),
        eq(actionableItems.userId, userId),
        eq(actionableItems.channelId, channelId),
        eq(actionableItems.messageTs, messageTs)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    logger.debug({ messageTs }, 'Actionable already detected for this message');
    return;
  }

  // Detect actionable using AI
  const result = await detectActionable({
    workspaceId,
    userId,
    messageText,
    messageAuthorId,
    threadContext,
    currentDate: new Date().toISOString().split('T')[0],
  });

  if (!result.hasActionable || !result.actionable) {
    return;
  }

  // Store the actionable
  try {
    await db.insert(actionableItems).values({
      workspaceId,
      userId,
      title: result.actionable.title,
      description: result.actionable.description,
      channelId,
      messageTs,
      threadTs,
      messageText,
      actionableType: result.actionable.type,
      dueDate: result.actionable.dueDate ? new Date(result.actionable.dueDate) : null,
      dueDateConfidence: result.actionable.dueDateConfidence,
      originalDueDateText: result.actionable.originalDueDateText,
      confidenceScore: result.actionable.confidenceScore,
      aiMetadata: {
        model: 'claude-sonnet-4-20250514',
        processingTimeMs: result.processingTimeMs,
        reasoning: result.actionable.reasoning,
      },
    });

    logger.info({
      workspaceId,
      userId,
      type: result.actionable.type,
      title: result.actionable.title,
      confidence: result.actionable.confidenceScore,
    }, 'Actionable item stored');
  } catch (error) {
    // Handle duplicate key error gracefully (race condition)
    if ((error as Error).message?.includes('duplicate key')) {
      logger.debug({ messageTs }, 'Actionable already exists (race condition)');
      return;
    }
    throw error;
  }
}

/**
 * Get pending actionables for a user
 * Includes snoozed items that have expired
 */
export async function getPendingActionables(
  workspaceId: string,
  userId: string
) {
  const now = new Date();

  return db
    .select()
    .from(actionableItems)
    .where(
      and(
        eq(actionableItems.workspaceId, workspaceId),
        eq(actionableItems.userId, userId),
        or(
          eq(actionableItems.status, 'pending'),
          and(
            eq(actionableItems.status, 'snoozed'),
            lt(actionableItems.snoozedUntil, now) // Snooze expired
          )
        )
      )
    )
    .orderBy(
      // Due soonest first (nulls last)
      sql`${actionableItems.dueDate} NULLS LAST`,
      desc(actionableItems.confidenceScore),
      desc(actionableItems.detectedAt)
    );
}

/**
 * Get all actionables for a user with optional status filter
 */
export async function getActionables(
  workspaceId: string,
  userId: string,
  options?: {
    status?: ActionableStatus;
    limit?: number;
  }
) {
  let query = db
    .select()
    .from(actionableItems)
    .where(
      and(
        eq(actionableItems.workspaceId, workspaceId),
        eq(actionableItems.userId, userId),
        options?.status ? eq(actionableItems.status, options.status) : undefined
      )
    )
    .orderBy(desc(actionableItems.detectedAt));

  if (options?.limit) {
    query = query.limit(options.limit) as typeof query;
  }

  return query;
}

/**
 * Get a single actionable by ID
 */
export async function getActionableById(
  workspaceId: string,
  userId: string,
  actionableId: string
) {
  const [item] = await db
    .select()
    .from(actionableItems)
    .where(
      and(
        eq(actionableItems.id, actionableId),
        eq(actionableItems.workspaceId, workspaceId),
        eq(actionableItems.userId, userId)
      )
    )
    .limit(1);

  return item || null;
}

/**
 * Update actionable status
 */
export async function updateActionableStatus(
  workspaceId: string,
  userId: string,
  actionableId: string,
  status: ActionableStatus,
  snoozedUntil?: Date
): Promise<boolean> {
  const updated = await db
    .update(actionableItems)
    .set({
      status,
      snoozedUntil: status === 'snoozed' ? snoozedUntil : null,
      completedAt: status === 'completed' ? new Date() : null,
      dismissedAt: status === 'dismissed' ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(actionableItems.id, actionableId),
        eq(actionableItems.workspaceId, workspaceId),
        eq(actionableItems.userId, userId)
      )
    )
    .returning();

  if (updated.length > 0) {
    logger.info({
      actionableId,
      status,
      snoozedUntil: snoozedUntil?.toISOString(),
    }, 'Actionable status updated');
  }

  return updated.length > 0;
}

/**
 * Delete an actionable
 */
export async function deleteActionable(
  workspaceId: string,
  userId: string,
  actionableId: string
): Promise<boolean> {
  const deleted = await db
    .delete(actionableItems)
    .where(
      and(
        eq(actionableItems.id, actionableId),
        eq(actionableItems.workspaceId, workspaceId),
        eq(actionableItems.userId, userId)
      )
    )
    .returning();

  return deleted.length > 0;
}

/**
 * Get actionables summary for a user (for daily digest)
 */
export async function getActionablesSummary(workspaceId: string, userId: string) {
  const pending = await getPendingActionables(workspaceId, userId);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  const overdue = pending.filter((a) => a.dueDate && a.dueDate < now);
  const dueToday = pending.filter((a) => {
    if (!a.dueDate) return false;
    return a.dueDate >= today && a.dueDate < tomorrow;
  });
  const upcoming = pending.filter((a) => {
    if (!a.dueDate) return false;
    return a.dueDate >= tomorrow && a.dueDate <= nextWeek;
  });
  const noDueDate = pending.filter((a) => !a.dueDate);

  return {
    total: pending.length,
    overdue,
    dueToday,
    upcoming,
    noDueDate,
  };
}

/**
 * Get actionable stats for dashboard
 */
export async function getActionableStats(workspaceId: string, userId: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  // Get all actionables
  const all = await db
    .select()
    .from(actionableItems)
    .where(
      and(
        eq(actionableItems.workspaceId, workspaceId),
        eq(actionableItems.userId, userId)
      )
    );

  const pending = all.filter(
    (a) => a.status === 'pending' || (a.status === 'snoozed' && a.snoozedUntil && a.snoozedUntil < now)
  );
  const completed = all.filter((a) => a.status === 'completed');
  const dismissed = all.filter((a) => a.status === 'dismissed');
  const overdue = pending.filter((a) => a.dueDate && a.dueDate < now);
  const dueToday = pending.filter((a) => {
    if (!a.dueDate) return false;
    return a.dueDate >= today && a.dueDate < tomorrow;
  });

  return {
    pending: pending.length,
    completed: completed.length,
    dismissed: dismissed.length,
    overdue: overdue.length,
    dueToday: dueToday.length,
  };
}
