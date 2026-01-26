import { db, userStylePreferences } from '@slack-speak/database';
import {
  StylePreferencesInputSchema,
  type StylePreferencesInput,
  type StylePreferences,
  type ToneOption,
  type FormalityOption,
} from '@slack-speak/validation';
import { eq, and } from 'drizzle-orm';

/**
 * Get style preferences for a user in a workspace
 *
 * @param workspaceId - UUID of the workspace
 * @param userId - Slack user ID
 * @returns User's style preferences or null if not found
 */
export async function getStylePreferences(
  workspaceId: string,
  userId: string
): Promise<StylePreferences | null> {
  const results = await db
    .select()
    .from(userStylePreferences)
    .where(
      and(
        eq(userStylePreferences.workspaceId, workspaceId),
        eq(userStylePreferences.userId, userId)
      )
    )
    .limit(1);

  if (results.length === 0) {
    return null;
  }

  const row = results[0];

  // Convert database row to StylePreferences type
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    userId: row.userId,
    tone: (row.tone as ToneOption) ?? undefined,
    formality: (row.formality as FormalityOption) ?? undefined,
    preferredPhrases: Array.isArray(row.preferredPhrases) ? row.preferredPhrases : undefined,
    avoidPhrases: Array.isArray(row.avoidPhrases) ? row.avoidPhrases : undefined,
    customGuidance: row.customGuidance ?? undefined,
    updatedAt: row.updatedAt ?? new Date(),
  };
}

/**
 * Create or update style preferences for a user
 *
 * @param workspaceId - UUID of the workspace
 * @param userId - Slack user ID
 * @param input - Style preferences to save
 * @returns Updated style preferences
 * @throws ZodError if input validation fails
 */
export async function upsertStylePreferences(
  workspaceId: string,
  userId: string,
  input: StylePreferencesInput
): Promise<StylePreferences> {
  // Validate input
  const validated = StylePreferencesInputSchema.parse(input);

  // Check if preferences already exist
  const existing = await getStylePreferences(workspaceId, userId);

  if (existing) {
    // Update existing preferences
    const updated = await db
      .update(userStylePreferences)
      .set({
        tone: validated.tone ?? null,
        formality: validated.formality ?? null,
        preferredPhrases: validated.preferredPhrases ?? [],
        avoidPhrases: validated.avoidPhrases ?? [],
        customGuidance: validated.customGuidance ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userStylePreferences.workspaceId, workspaceId),
          eq(userStylePreferences.userId, userId)
        )
      )
      .returning();

    const row = updated[0];

    return {
      id: row.id,
      workspaceId: row.workspaceId,
      userId: row.userId,
      tone: (row.tone as ToneOption) ?? undefined,
      formality: (row.formality as FormalityOption) ?? undefined,
      preferredPhrases: Array.isArray(row.preferredPhrases) ? row.preferredPhrases : undefined,
      avoidPhrases: Array.isArray(row.avoidPhrases) ? row.avoidPhrases : undefined,
      customGuidance: row.customGuidance ?? undefined,
      updatedAt: row.updatedAt ?? new Date(),
    };
  } else {
    // Create new preferences
    const created = await db
      .insert(userStylePreferences)
      .values({
        workspaceId,
        userId,
        tone: validated.tone ?? null,
        formality: validated.formality ?? null,
        preferredPhrases: validated.preferredPhrases ?? [],
        avoidPhrases: validated.avoidPhrases ?? [],
        customGuidance: validated.customGuidance ?? null,
      })
      .returning();

    const row = created[0];

    return {
      id: row.id,
      workspaceId: row.workspaceId,
      userId: row.userId,
      tone: (row.tone as ToneOption) ?? undefined,
      formality: (row.formality as FormalityOption) ?? undefined,
      preferredPhrases: Array.isArray(row.preferredPhrases) ? row.preferredPhrases : undefined,
      avoidPhrases: Array.isArray(row.avoidPhrases) ? row.avoidPhrases : undefined,
      customGuidance: row.customGuidance ?? undefined,
      updatedAt: row.updatedAt ?? new Date(),
    };
  }
}

/**
 * Delete style preferences for a user
 *
 * @param workspaceId - UUID of the workspace
 * @param userId - Slack user ID
 * @returns true if preferences were deleted, false if they didn't exist
 */
export async function deleteStylePreferences(
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const deleted = await db
    .delete(userStylePreferences)
    .where(
      and(
        eq(userStylePreferences.workspaceId, workspaceId),
        eq(userStylePreferences.userId, userId)
      )
    )
    .returning();

  return deleted.length > 0;
}
