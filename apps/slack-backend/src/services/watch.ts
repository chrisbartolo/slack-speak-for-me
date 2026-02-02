import { db, watchedConversations, threadParticipants, workspaces, autoRespondLog } from '@slack-speak/database';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Look up internal workspace UUID from Slack team ID
 */
export async function getWorkspaceId(teamId: string): Promise<string | null> {
  const result = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.teamId, teamId))
    .limit(1);

  return result.length > 0 ? result[0].id : null;
}

/**
 * Watch a conversation for a user
 * Uses upsert pattern to handle duplicate watches gracefully
 * Stores channel name and type for display and DM handling
 */
export async function watchConversation(
  workspaceId: string,
  userId: string,
  channelId: string,
  channelName?: string,
  channelType?: string
): Promise<void> {
  const insertQuery = db.insert(watchedConversations).values({
    workspaceId,
    userId,
    channelId,
    channelName,
    channelType,
  });

  // If we have channel info to update, use onConflictDoUpdate
  // Otherwise, use onConflictDoNothing to maintain backward compatibility
  if (channelName !== undefined || channelType !== undefined) {
    const setValues: Record<string, string | undefined> = {};
    if (channelName !== undefined) setValues.channelName = channelName;
    if (channelType !== undefined) setValues.channelType = channelType;

    await insertQuery.onConflictDoUpdate({
      target: [watchedConversations.workspaceId, watchedConversations.userId, watchedConversations.channelId],
      set: setValues,
    });
  } else {
    await insertQuery.onConflictDoNothing();
  }
}

/**
 * Unwatch a conversation for a user
 */
export async function unwatchConversation(
  workspaceId: string,
  userId: string,
  channelId: string
): Promise<void> {
  await db.delete(watchedConversations).where(
    and(
      eq(watchedConversations.workspaceId, workspaceId),
      eq(watchedConversations.userId, userId),
      eq(watchedConversations.channelId, channelId)
    )
  );
}

/**
 * Check if user is watching a specific conversation
 */
export async function isWatching(
  workspaceId: string,
  userId: string,
  channelId: string
): Promise<boolean> {
  const result = await db.select().from(watchedConversations).where(
    and(
      eq(watchedConversations.workspaceId, workspaceId),
      eq(watchedConversations.userId, userId),
      eq(watchedConversations.channelId, channelId)
    )
  ).limit(1);

  return result.length > 0;
}

/**
 * Get all watched conversations for a user
 * Returns array of channel IDs
 */
export async function getWatchedConversations(
  workspaceId: string,
  userId: string
): Promise<string[]> {
  const results = await db.select({
    channelId: watchedConversations.channelId,
  }).from(watchedConversations).where(
    and(
      eq(watchedConversations.workspaceId, workspaceId),
      eq(watchedConversations.userId, userId)
    )
  );

  return results.map(r => r.channelId);
}

/**
 * Record thread participation (for trigger detection)
 * Uses upsert pattern to update last_message_at on conflict
 */
export async function recordThreadParticipation(
  workspaceId: string,
  userId: string,
  channelId: string,
  threadTs: string
): Promise<void> {
  await db.insert(threadParticipants).values({
    workspaceId,
    userId,
    channelId,
    threadTs,
    lastMessageAt: new Date(),
  }).onConflictDoUpdate({
    target: [
      threadParticipants.workspaceId,
      threadParticipants.userId,
      threadParticipants.channelId,
      threadParticipants.threadTs,
    ],
    set: {
      lastMessageAt: new Date(),
    },
  });
}

/**
 * Check if user is participating in a thread (posted within last 7 days)
 */
export async function isParticipatingInThread(
  workspaceId: string,
  userId: string,
  channelId: string,
  threadTs: string
): Promise<boolean> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const result = await db.select().from(threadParticipants).where(
    and(
      eq(threadParticipants.workspaceId, workspaceId),
      eq(threadParticipants.userId, userId),
      eq(threadParticipants.channelId, channelId),
      eq(threadParticipants.threadTs, threadTs),
      sql`${threadParticipants.lastMessageAt} > ${sevenDaysAgo}`
    )
  ).limit(1);

  return result.length > 0;
}

/**
 * Get all users who are watching a specific channel
 * Used for DM message handling to find who should receive suggestions
 */
export async function getWatchersForChannel(
  workspaceId: string,
  channelId: string
): Promise<string[]> {
  const results = await db.select({
    userId: watchedConversations.userId,
  }).from(watchedConversations).where(
    and(
      eq(watchedConversations.workspaceId, workspaceId),
      eq(watchedConversations.channelId, channelId)
    )
  );
  return results.map(r => r.userId);
}

/**
 * Check if auto-respond (YOLO mode) is enabled for a conversation
 */
export async function isAutoRespondEnabled(
  workspaceId: string,
  userId: string,
  channelId: string
): Promise<boolean> {
  const result = await db
    .select({ autoRespond: watchedConversations.autoRespond })
    .from(watchedConversations)
    .where(
      and(
        eq(watchedConversations.workspaceId, workspaceId),
        eq(watchedConversations.userId, userId),
        eq(watchedConversations.channelId, channelId)
      )
    )
    .limit(1);

  return result.length > 0 && result[0].autoRespond === true;
}

/**
 * Log an auto-sent message for YOLO mode
 */
export async function logAutoResponse(params: {
  workspaceId: string;
  userId: string;
  channelId: string;
  threadTs?: string;
  triggerMessageTs: string;
  triggerMessageText?: string;
  responseText: string;
  responseMessageTs?: string;
}): Promise<string> {
  const [result] = await db
    .insert(autoRespondLog)
    .values({
      workspaceId: params.workspaceId,
      userId: params.userId,
      channelId: params.channelId,
      threadTs: params.threadTs,
      triggerMessageTs: params.triggerMessageTs,
      triggerMessageText: params.triggerMessageText,
      responseText: params.responseText,
      responseMessageTs: params.responseMessageTs,
      status: 'sent',
    })
    .returning({ id: autoRespondLog.id });

  return result.id;
}

/**
 * Mark an auto-response as undone
 */
export async function undoAutoResponse(
  logId: string,
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const result = await db
    .update(autoRespondLog)
    .set({
      status: 'undone',
      undoneAt: new Date(),
    })
    .where(
      and(
        eq(autoRespondLog.id, logId),
        eq(autoRespondLog.workspaceId, workspaceId),
        eq(autoRespondLog.userId, userId)
      )
    )
    .returning();

  return result.length > 0;
}
