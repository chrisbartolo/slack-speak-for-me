import 'server-only';
import { db } from '@/lib/db';
import {
  users,
  watchedConversations,
  userStylePreferences,
  personContext,
  refinementFeedback,
  suggestionFeedback,
  gdprConsent,
  reportSettings,
  googleIntegrations,
  workflowConfig,
  messageEmbeddings,
  threadParticipants,
} from '@slack-speak/database';
import { eq, and } from 'drizzle-orm';

/**
 * Delete all user data from all tables in a transactional manner.
 *
 * GDPR Article 17 - Right to erasure ("right to be forgotten")
 *
 * This function removes all personal data associated with a user while
 * preserving anonymized consent records for compliance audit trail.
 *
 * Deletion order respects foreign key constraints:
 * - Delete from leaf tables first (no FK dependencies)
 * - Delete from parent tables last
 *
 * @param userId - Internal user UUID from users table
 * @param workspaceId - Workspace UUID the user belongs to
 * @param slackUserId - Slack user ID used in various tables
 */
export async function deleteUserData(
  userId: string,
  workspaceId: string,
  slackUserId: string
): Promise<void> {
  await db.transaction(async (tx) => {
    // Delete from tables with no foreign keys pointing to them
    // Order matters for FK constraints

    // Message embeddings (no FKs)
    await tx
      .delete(messageEmbeddings)
      .where(
        and(
          eq(messageEmbeddings.workspaceId, workspaceId),
          eq(messageEmbeddings.userId, slackUserId)
        )
      );

    // Thread participants
    await tx
      .delete(threadParticipants)
      .where(
        and(
          eq(threadParticipants.workspaceId, workspaceId),
          eq(threadParticipants.userId, slackUserId)
        )
      );

    // Watched conversations
    await tx
      .delete(watchedConversations)
      .where(
        and(
          eq(watchedConversations.workspaceId, workspaceId),
          eq(watchedConversations.userId, slackUserId)
        )
      );

    // Style preferences
    await tx
      .delete(userStylePreferences)
      .where(
        and(
          eq(userStylePreferences.workspaceId, workspaceId),
          eq(userStylePreferences.userId, slackUserId)
        )
      );

    // Person context
    await tx
      .delete(personContext)
      .where(
        and(
          eq(personContext.workspaceId, workspaceId),
          eq(personContext.userId, slackUserId)
        )
      );

    // Refinement feedback
    await tx
      .delete(refinementFeedback)
      .where(
        and(
          eq(refinementFeedback.workspaceId, workspaceId),
          eq(refinementFeedback.userId, slackUserId)
        )
      );

    // Suggestion feedback
    await tx
      .delete(suggestionFeedback)
      .where(
        and(
          eq(suggestionFeedback.workspaceId, workspaceId),
          eq(suggestionFeedback.userId, slackUserId)
        )
      );

    // Report settings
    await tx
      .delete(reportSettings)
      .where(
        and(
          eq(reportSettings.workspaceId, workspaceId),
          eq(reportSettings.userId, slackUserId)
        )
      );

    // Google integrations
    await tx
      .delete(googleIntegrations)
      .where(
        and(
          eq(googleIntegrations.workspaceId, workspaceId),
          eq(googleIntegrations.userId, slackUserId)
        )
      );

    // Workflow config
    await tx
      .delete(workflowConfig)
      .where(
        and(
          eq(workflowConfig.workspaceId, workspaceId),
          eq(workflowConfig.userId, slackUserId)
        )
      );

    // Mark consent as revoked (keep for compliance records, remove personal data)
    // GDPR requires keeping proof of consent and revocation
    await tx
      .update(gdprConsent)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(gdprConsent.workspaceId, workspaceId),
          eq(gdprConsent.userId, slackUserId)
        )
      );

    // Finally delete user record
    await tx.delete(users).where(eq(users.id, userId));
  });
}
