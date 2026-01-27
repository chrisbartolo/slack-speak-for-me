'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { userStylePreferences } from '@slack-speak/database';
import { verifySession } from '@/lib/auth/dal';
import { stylePreferencesSchema } from '@/lib/validations/style';

export type ActionResult = {
  success?: boolean;
  errors?: Record<string, string[]>;
};

export async function updateStylePreferences(formData: FormData): Promise<ActionResult> {
  const session = await verifySession();

  // Parse form data
  const rawData = {
    tone: formData.get('tone') as string | null,
    formality: formData.get('formality') as string | null,
    preferredPhrases: JSON.parse((formData.get('preferredPhrases') as string) || '[]'),
    avoidPhrases: JSON.parse((formData.get('avoidPhrases') as string) || '[]'),
    customGuidance: formData.get('customGuidance') as string | null,
  };

  // Handle empty strings as null
  if (rawData.tone === '') rawData.tone = null;
  if (rawData.formality === '') rawData.formality = null;
  if (rawData.customGuidance === '') rawData.customGuidance = null;

  // Validate
  const result = stylePreferencesSchema.safeParse(rawData);

  if (!result.success) {
    return {
      errors: result.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { tone, formality, preferredPhrases, avoidPhrases, customGuidance } = result.data;

  // Upsert preferences
  await db
    .insert(userStylePreferences)
    .values({
      workspaceId: session.workspaceId,
      userId: session.userId,
      tone,
      formality,
      preferredPhrases,
      avoidPhrases,
      customGuidance,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [userStylePreferences.workspaceId, userStylePreferences.userId],
      set: {
        tone,
        formality,
        preferredPhrases,
        avoidPhrases,
        customGuidance,
        updatedAt: new Date(),
      },
    });

  revalidatePath('/style');
  revalidatePath('/');

  return { success: true };
}
