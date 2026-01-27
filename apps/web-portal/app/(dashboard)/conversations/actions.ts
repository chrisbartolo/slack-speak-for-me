'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { watchedConversations } from '@slack-speak/database';
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
