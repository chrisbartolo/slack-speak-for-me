import { db, watchedConversations, threadParticipants, workspaces } from '@slack-speak/database';
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
 */
export async function watchConversation(
  workspaceId: string,
  userId: string,
  channelId: string
): Promise<void> {
  await db.insert(watchedConversations).values({
    workspaceId,
    userId,
    channelId,
  }).onConflictDoNothing();
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
