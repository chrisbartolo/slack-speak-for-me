'use server';

import { revalidatePath } from 'next/cache';
import { db, schema } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { verifySession } from '@/lib/auth/dal';
import { personContextSchema } from '@/lib/validations/person-context';

const { personContext } = schema;

export type ActionResult = {
  success?: boolean;
  error?: string;
  errors?: Record<string, string[]>;
};

export async function savePersonContext(formData: FormData): Promise<ActionResult> {
  const session = await verifySession();

  const rawData = {
    targetSlackUserId: formData.get('targetSlackUserId') as string,
    contextText: formData.get('contextText') as string,
  };

  const result = personContextSchema.safeParse(rawData);

  if (!result.success) {
    return {
      errors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { targetSlackUserId, contextText } = result.data;

  try {
    // Upsert - create or update
    // Type casts to work around Drizzle ORM type inference issue with re-exported schemas
    const insertValues = {
      workspaceId: session.workspaceId,
      userId: session.userId,
      targetSlackUserId,
      contextText,
      updatedAt: new Date(),
    } as typeof personContext.$inferInsert;

    const updateValues = {
      contextText,
      updatedAt: new Date(),
    } as Partial<typeof personContext.$inferInsert>;

    await db
      .insert(personContext)
      .values(insertValues)
      .onConflictDoUpdate({
        target: [personContext.workspaceId, personContext.userId, personContext.targetSlackUserId],
        set: updateValues,
      });

    revalidatePath('/people');
    return { success: true };
  } catch (error) {
    console.error('Error saving person context:', error);
    return { error: 'Failed to save context' };
  }
}

export async function deletePersonContext(id: string): Promise<ActionResult> {
  const session = await verifySession();

  try {
    const deleted = await db
      .delete(personContext)
      .where(
        and(
          eq(personContext.id, id),
          eq(personContext.workspaceId, session.workspaceId),
          eq(personContext.userId, session.userId)
        )
      )
      .returning();

    if (deleted.length === 0) {
      return { error: 'Context not found or already deleted' };
    }

    revalidatePath('/people');
    return { success: true };
  } catch (error) {
    console.error('Error deleting person context:', error);
    return { error: 'Failed to delete context' };
  }
}
