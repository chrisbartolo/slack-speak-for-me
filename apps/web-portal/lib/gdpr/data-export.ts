import 'server-only';
import { db } from '@/lib/db';
import {
  users,
  workspaces,
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
 * Structure of exported user data for GDPR compliance
 */
export interface ExportedUserData {
  exportedAt: string;
  user: {
    id: string;
    slackUserId: string;
    email: string | null;
    role: string | null;
    createdAt: string | null;
  };
  workspace: {
    id: string;
    name: string | null;
    teamId: string;
  };
  preferences: {
    stylePreferences: {
      tone: string | null;
      formality: string | null;
      preferredPhrases: string[];
      avoidPhrases: string[];
      customGuidance: string | null;
    } | null;
    reportSettings: {
      enabled: boolean | null;
      dayOfWeek: number | null;
      timeOfDay: string | null;
      timezone: string | null;
      format: string | null;
      sections: string[];
      autoSend: boolean | null;
      recipientChannelId: string | null;
    } | null;
    personContexts: Array<{
      targetSlackUserId: string;
      targetUserName: string | null;
      contextText: string;
      createdAt: string | null;
      updatedAt: string | null;
    }>;
  };
  activity: {
    watchedConversations: Array<{
      channelId: string;
      channelName: string | null;
      channelType: string | null;
      watchedAt: string | null;
    }>;
    suggestionFeedback: Array<{
      suggestionId: string;
      action: string;
      originalText: string | null;
      finalText: string | null;
      triggerContext: string | null;
      channelId: string | null;
      createdAt: string | null;
    }>;
    refinementFeedback: Array<{
      suggestionId: string;
      originalText: string;
      modifiedText: string;
      refinementType: string | null;
      createdAt: string | null;
    }>;
    threadParticipants: Array<{
      channelId: string;
      threadTs: string;
      lastMessageAt: string | null;
    }>;
  };
  integrations: {
    googleConnected: boolean;
    spreadsheetName: string | null;
    workflowConfigs: Array<{
      channelId: string;
      channelName: string | null;
      enabled: boolean | null;
      createdAt: string | null;
    }>;
  };
  consent: {
    records: Array<{
      consentType: string;
      consentedAt: string | null;
      revokedAt: string | null;
      createdAt: string | null;
    }>;
  };
  messageHistory: {
    embeddingCount: number;
    // We don't export raw message content or embeddings for privacy reasons
    // Users should know how many messages we have stored
  };
}

/**
 * Export all user data for GDPR compliance (Article 20 - Right to Data Portability)
 *
 * @param userId - Internal user UUID
 * @param workspaceId - Internal workspace UUID
 * @param slackUserId - Slack user ID
 * @returns Structured JSON with all user data
 */
export async function exportUserData(
  userId: string,
  workspaceId: string,
  slackUserId: string
): Promise<ExportedUserData> {
  // Query all tables in parallel for efficiency
  const [
    userRecord,
    workspaceRecord,
    stylePrefs,
    reportSettingsRecord,
    personContexts,
    watchedConvos,
    suggestionFeedbacks,
    refinementFeedbacks,
    threadParticipantsRecords,
    googleIntegration,
    workflowConfigs,
    consentRecords,
    embeddingCount,
  ] = await Promise.all([
    // User info
    db.query.users.findFirst({
      where: and(eq(users.workspaceId, workspaceId), eq(users.slackUserId, slackUserId)),
    }),

    // Workspace info
    db.query.workspaces.findFirst({
      where: eq(workspaces.id, workspaceId),
    }),

    // Style preferences
    db.query.userStylePreferences.findFirst({
      where: and(
        eq(userStylePreferences.workspaceId, workspaceId),
        eq(userStylePreferences.userId, slackUserId)
      ),
    }),

    // Report settings
    db.query.reportSettings.findFirst({
      where: and(
        eq(reportSettings.workspaceId, workspaceId),
        eq(reportSettings.userId, slackUserId)
      ),
    }),

    // Person contexts
    db
      .select()
      .from(personContext)
      .where(
        and(
          eq(personContext.workspaceId, workspaceId),
          eq(personContext.userId, slackUserId)
        )
      ),

    // Watched conversations
    db
      .select()
      .from(watchedConversations)
      .where(
        and(
          eq(watchedConversations.workspaceId, workspaceId),
          eq(watchedConversations.userId, slackUserId)
        )
      ),

    // Suggestion feedback
    db
      .select()
      .from(suggestionFeedback)
      .where(
        and(
          eq(suggestionFeedback.workspaceId, workspaceId),
          eq(suggestionFeedback.userId, slackUserId)
        )
      ),

    // Refinement feedback
    db
      .select()
      .from(refinementFeedback)
      .where(
        and(
          eq(refinementFeedback.workspaceId, workspaceId),
          eq(refinementFeedback.userId, slackUserId)
        )
      ),

    // Thread participants
    db
      .select()
      .from(threadParticipants)
      .where(
        and(
          eq(threadParticipants.workspaceId, workspaceId),
          eq(threadParticipants.userId, slackUserId)
        )
      ),

    // Google integration (we'll redact tokens)
    db.query.googleIntegrations.findFirst({
      where: and(
        eq(googleIntegrations.workspaceId, workspaceId),
        eq(googleIntegrations.userId, slackUserId)
      ),
    }),

    // Workflow configs
    db
      .select()
      .from(workflowConfig)
      .where(
        and(
          eq(workflowConfig.workspaceId, workspaceId),
          eq(workflowConfig.userId, slackUserId)
        )
      ),

    // GDPR consent records
    db
      .select()
      .from(gdprConsent)
      .where(
        and(
          eq(gdprConsent.workspaceId, workspaceId),
          eq(gdprConsent.userId, slackUserId)
        )
      ),

    // Message embeddings count (we don't export the actual content)
    db
      .select()
      .from(messageEmbeddings)
      .where(
        and(
          eq(messageEmbeddings.workspaceId, workspaceId),
          eq(messageEmbeddings.userId, slackUserId)
        )
      )
      .then((rows) => rows.length),
  ]);

  // Build the export object
  const exportData: ExportedUserData = {
    exportedAt: new Date().toISOString(),

    user: {
      id: userRecord?.id || userId,
      slackUserId: userRecord?.slackUserId || slackUserId,
      email: userRecord?.email || null,
      role: userRecord?.role || null,
      createdAt: userRecord?.createdAt?.toISOString() || null,
    },

    workspace: {
      id: workspaceRecord?.id || workspaceId,
      name: workspaceRecord?.name || null,
      teamId: workspaceRecord?.teamId || '',
    },

    preferences: {
      stylePreferences: stylePrefs
        ? {
            tone: stylePrefs.tone,
            formality: stylePrefs.formality,
            preferredPhrases: stylePrefs.preferredPhrases || [],
            avoidPhrases: stylePrefs.avoidPhrases || [],
            customGuidance: stylePrefs.customGuidance,
          }
        : null,

      reportSettings: reportSettingsRecord
        ? {
            enabled: reportSettingsRecord.enabled,
            dayOfWeek: reportSettingsRecord.dayOfWeek,
            timeOfDay: reportSettingsRecord.timeOfDay,
            timezone: reportSettingsRecord.timezone,
            format: reportSettingsRecord.format,
            sections: reportSettingsRecord.sections || [],
            autoSend: reportSettingsRecord.autoSend,
            recipientChannelId: reportSettingsRecord.recipientChannelId,
          }
        : null,

      personContexts: personContexts.map((ctx) => ({
        targetSlackUserId: ctx.targetSlackUserId,
        targetUserName: ctx.targetUserName,
        contextText: ctx.contextText,
        createdAt: ctx.createdAt?.toISOString() || null,
        updatedAt: ctx.updatedAt?.toISOString() || null,
      })),
    },

    activity: {
      watchedConversations: watchedConvos.map((wc) => ({
        channelId: wc.channelId,
        channelName: wc.channelName,
        channelType: wc.channelType,
        watchedAt: wc.watchedAt?.toISOString() || null,
      })),

      suggestionFeedback: suggestionFeedbacks.map((sf) => ({
        suggestionId: sf.suggestionId,
        action: sf.action,
        originalText: sf.originalText,
        finalText: sf.finalText,
        triggerContext: sf.triggerContext,
        channelId: sf.channelId,
        createdAt: sf.createdAt?.toISOString() || null,
      })),

      refinementFeedback: refinementFeedbacks.map((rf) => ({
        suggestionId: rf.suggestionId,
        originalText: rf.originalText,
        modifiedText: rf.modifiedText,
        refinementType: rf.refinementType,
        createdAt: rf.createdAt?.toISOString() || null,
      })),

      threadParticipants: threadParticipantsRecords.map((tp) => ({
        channelId: tp.channelId,
        threadTs: tp.threadTs,
        lastMessageAt: tp.lastMessageAt?.toISOString() || null,
      })),
    },

    integrations: {
      // Don't export OAuth tokens - just indicate connected status
      googleConnected: !!googleIntegration,
      spreadsheetName: googleIntegration?.spreadsheetName || null,

      workflowConfigs: workflowConfigs.map((wf) => ({
        channelId: wf.channelId,
        channelName: wf.channelName,
        enabled: wf.enabled,
        createdAt: wf.createdAt?.toISOString() || null,
      })),
    },

    consent: {
      records: consentRecords.map((cr) => ({
        consentType: cr.consentType,
        consentedAt: cr.consentedAt?.toISOString() || null,
        revokedAt: cr.revokedAt?.toISOString() || null,
        createdAt: cr.createdAt?.toISOString() || null,
      })),
    },

    messageHistory: {
      embeddingCount,
    },
  };

  return exportData;
}
