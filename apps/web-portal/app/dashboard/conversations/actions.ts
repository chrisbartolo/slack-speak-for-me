'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { watchedConversations, conversationContext } from '@slack-speak/database';
import { eq, and } from 'drizzle-orm';
import { verifySession } from '@/lib/auth/dal';

export type ActionResult = {
  success?: boolean;
  error?: string;
};

export async function unwatchConversation(conversationId: string): Promise<ActionResult> {
  const session = await verifySession();

  try {
    // Verify ownership and delete
    const deleted = await db
      .delete(watchedConversations)
      .where(
        and(
          eq(watchedConversations.id, conversationId),
          eq(watchedConversations.workspaceId, session.workspaceId),
          eq(watchedConversations.userId, session.userId)
        )
      )
      .returning();

    if (deleted.length === 0) {
      return { error: 'Conversation not found or already removed' };
    }

    revalidatePath('/conversations');
    revalidatePath('/');

    return { success: true };
  } catch (error) {
    console.error('Error unwatching conversation:', error);
    return { error: 'Failed to remove conversation' };
  }
}

// Note: Adding new channels to watch is done via Slack slash commands (/watch)
// The web portal only shows existing watches and allows removing them

/**
 * Toggle auto-respond (YOLO mode) for a conversation
 */
export async function toggleAutoRespond(conversationId: string, enabled: boolean): Promise<ActionResult> {
  const session = await verifySession();

  try {
    const updated = await db
      .update(watchedConversations)
      .set({ autoRespond: enabled })
      .where(
        and(
          eq(watchedConversations.id, conversationId),
          eq(watchedConversations.workspaceId, session.workspaceId),
          eq(watchedConversations.userId, session.userId)
        )
      )
      .returning();

    if (updated.length === 0) {
      return { error: 'Conversation not found' };
    }

    revalidatePath('/dashboard/conversations');

    return { success: true };
  } catch (error) {
    console.error('Error toggling auto-respond:', error);
    return { error: 'Failed to update auto-respond setting' };
  }
}

/**
 * Save or update context for a conversation
 */
export async function saveConversationContext(
  channelId: string,
  channelName: string | null,
  channelType: string | null,
  contextText: string
): Promise<ActionResult> {
  const session = await verifySession();

  if (!contextText.trim()) {
    return { error: 'Context text is required' };
  }

  if (contextText.length > 2000) {
    return { error: 'Context text must be under 2000 characters' };
  }

  try {
    await db
      .insert(conversationContext)
      .values({
        workspaceId: session.workspaceId,
        userId: session.userId,
        channelId,
        channelName,
        channelType,
        contextText: contextText.trim(),
      })
      .onConflictDoUpdate({
        target: [conversationContext.workspaceId, conversationContext.userId, conversationContext.channelId],
        set: {
          contextText: contextText.trim(),
          channelName,
          channelType,
          updatedAt: new Date(),
        },
      });

    revalidatePath('/dashboard/conversations');

    return { success: true };
  } catch (error) {
    console.error('Error saving conversation context:', error);
    return { error: 'Failed to save context' };
  }
}

/**
 * Delete context for a conversation
 */
export async function deleteConversationContext(channelId: string): Promise<ActionResult> {
  const session = await verifySession();

  try {
    await db
      .delete(conversationContext)
      .where(
        and(
          eq(conversationContext.workspaceId, session.workspaceId),
          eq(conversationContext.userId, session.userId),
          eq(conversationContext.channelId, channelId)
        )
      );

    revalidatePath('/dashboard/conversations');

    return { success: true };
  } catch (error) {
    console.error('Error deleting conversation context:', error);
    return { error: 'Failed to delete context' };
  }
}
