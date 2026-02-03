'use server';

import { revalidatePath } from 'next/cache';
import { eq, and } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { verifySession } from '@/lib/auth/dal';

const { actionableItems } = schema;

export async function completeTask(taskId: string, completionNote?: string) {
  try {
    const session = await verifySession();

    await db
      .update(actionableItems)
      .set({
        status: 'completed',
        completedAt: new Date(),
        completionNote: completionNote || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(actionableItems.id, taskId),
          eq(actionableItems.workspaceId, session.workspaceId),
          eq(actionableItems.userId, session.userId)
        )
      );

    revalidatePath('/dashboard/tasks');
    return { success: true };
  } catch (error) {
    console.error('Failed to complete task:', error);
    return { success: false, error: 'Failed to complete task' };
  }
}

export async function dismissTask(taskId: string) {
  try {
    const session = await verifySession();

    await db
      .update(actionableItems)
      .set({
        status: 'dismissed',
        dismissedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(actionableItems.id, taskId),
          eq(actionableItems.workspaceId, session.workspaceId),
          eq(actionableItems.userId, session.userId)
        )
      );

    revalidatePath('/dashboard/tasks');
    return { success: true };
  } catch (error) {
    console.error('Failed to dismiss task:', error);
    return { success: false, error: 'Failed to dismiss task' };
  }
}

export async function snoozeTask(taskId: string, hours: number) {
  try {
    const session = await verifySession();

    const snoozedUntil = new Date(Date.now() + hours * 60 * 60 * 1000);

    await db
      .update(actionableItems)
      .set({
        status: 'snoozed',
        snoozedUntil,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(actionableItems.id, taskId),
          eq(actionableItems.workspaceId, session.workspaceId),
          eq(actionableItems.userId, session.userId)
        )
      );

    revalidatePath('/dashboard/tasks');
    return { success: true };
  } catch (error) {
    console.error('Failed to snooze task:', error);
    return { success: false, error: 'Failed to snooze task' };
  }
}
