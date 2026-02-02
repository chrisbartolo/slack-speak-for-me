import 'server-only';
import { cache } from 'react';
import { eq, and, desc, count } from 'drizzle-orm';
import { db, schema } from './index';
import { verifySession } from '../auth/dal';

const {
  userStylePreferences,
  messageEmbeddings,
  watchedConversations,
  refinementFeedback,
  personContext,
  conversationContext,
  reportSettings,
  googleIntegrations,
  workflowConfig,
  suggestionFeedback,
  autoRespondLog,
} = schema;

/**
 * Get user's style preferences
 */
export const getStylePreferences = cache(async () => {
  const session = await verifySession();

  const [prefs] = await db
    .select()
    .from(userStylePreferences)
    .where(
      and(
        eq(userStylePreferences.workspaceId, session.workspaceId),
        eq(userStylePreferences.userId, session.userId)
      )
    )
    .limit(1);

  return prefs || null;
});

/**
 * Count of messages analyzed for learning
 */
export const getMessageCount = cache(async () => {
  const session = await verifySession();

  const [result] = await db
    .select({ count: count() })
    .from(messageEmbeddings)
    .where(
      and(
        eq(messageEmbeddings.workspaceId, session.workspaceId),
        eq(messageEmbeddings.userId, session.userId)
      )
    );

  return result?.count || 0;
});

/**
 * Count of watched conversations
 */
export const getWatchedConversationCount = cache(async () => {
  const session = await verifySession();

  const [result] = await db
    .select({ count: count() })
    .from(watchedConversations)
    .where(
      and(
        eq(watchedConversations.workspaceId, session.workspaceId),
        eq(watchedConversations.userId, session.userId)
      )
    );

  return result?.count || 0;
});

/**
 * Count of refinement feedback entries
 */
export const getRefinementCount = cache(async () => {
  const session = await verifySession();

  const [result] = await db
    .select({ count: count() })
    .from(refinementFeedback)
    .where(
      and(
        eq(refinementFeedback.workspaceId, session.workspaceId),
        eq(refinementFeedback.userId, session.userId)
      )
    );

  return result?.count || 0;
});

/**
 * Full list of watched conversations with channel info
 */
export const getWatchedConversations = cache(async () => {
  const session = await verifySession();

  const conversations = await db
    .select({
      id: watchedConversations.id,
      channelId: watchedConversations.channelId,
      channelName: watchedConversations.channelName,
      channelType: watchedConversations.channelType,
      autoRespond: watchedConversations.autoRespond,
      watchedAt: watchedConversations.watchedAt,
    })
    .from(watchedConversations)
    .where(
      and(
        eq(watchedConversations.workspaceId, session.workspaceId),
        eq(watchedConversations.userId, session.userId)
      )
    )
    .orderBy(desc(watchedConversations.watchedAt));

  return conversations;
});

/**
 * Full list of person context entries
 */
export const getPersonContexts = cache(async () => {
  const session = await verifySession();

  const contexts = await db
    .select()
    .from(personContext)
    .where(
      and(
        eq(personContext.workspaceId, session.workspaceId),
        eq(personContext.userId, session.userId)
      )
    )
    .orderBy(desc(personContext.updatedAt));

  return contexts;
});

/**
 * Count of person context entries
 */
export const getPersonContextCount = cache(async () => {
  const session = await verifySession();

  const [result] = await db
    .select({ count: count() })
    .from(personContext)
    .where(
      and(
        eq(personContext.workspaceId, session.workspaceId),
        eq(personContext.userId, session.userId)
      )
    );

  return result?.count || 0;
});

/**
 * Get refinement feedback history with pagination
 */
export const getRefinementFeedback = cache(async (limit = 50) => {
  const session = await verifySession();

  return db
    .select({
      id: refinementFeedback.id,
      suggestionId: refinementFeedback.suggestionId,
      originalText: refinementFeedback.originalText,
      modifiedText: refinementFeedback.modifiedText,
      refinementType: refinementFeedback.refinementType,
      createdAt: refinementFeedback.createdAt,
    })
    .from(refinementFeedback)
    .where(
      and(
        eq(refinementFeedback.workspaceId, session.workspaceId),
        eq(refinementFeedback.userId, session.userId)
      )
    )
    .orderBy(desc(refinementFeedback.createdAt))
    .limit(limit);
});

/**
 * Get feedback summary statistics by refinement type
 */
export const getFeedbackStats = cache(async () => {
  const session = await verifySession();

  const typeStats = await db
    .select({
      refinementType: refinementFeedback.refinementType,
      count: count(),
    })
    .from(refinementFeedback)
    .where(
      and(
        eq(refinementFeedback.workspaceId, session.workspaceId),
        eq(refinementFeedback.userId, session.userId)
      )
    )
    .groupBy(refinementFeedback.refinementType);

  return typeStats;
});

/**
 * Get user's report settings
 */
export const getReportSettings = cache(async () => {
  const session = await verifySession();

  const [settings] = await db
    .select()
    .from(reportSettings)
    .where(
      and(
        eq(reportSettings.workspaceId, session.workspaceId),
        eq(reportSettings.userId, session.userId)
      )
    )
    .limit(1);

  return settings ?? null;
});

/**
 * Get user's Google integration status
 */
export const getGoogleIntegration = cache(async () => {
  const session = await verifySession();

  const [integration] = await db
    .select()
    .from(googleIntegrations)
    .where(
      and(
        eq(googleIntegrations.workspaceId, session.workspaceId),
        eq(googleIntegrations.userId, session.userId)
      )
    )
    .limit(1);

  return integration || null;
});

/**
 * Get user's workflow configuration channels
 */
export const getWorkflowConfig = cache(async () => {
  const session = await verifySession();

  const configs = await db
    .select()
    .from(workflowConfig)
    .where(
      and(
        eq(workflowConfig.workspaceId, session.workspaceId),
        eq(workflowConfig.userId, session.userId)
      )
    );

  return configs;
});

/**
 * Get suggestion feedback history (accepted, refined, dismissed)
 */
export const getSuggestionFeedback = cache(async (limit = 50) => {
  const session = await verifySession();

  return db
    .select({
      id: suggestionFeedback.id,
      suggestionId: suggestionFeedback.suggestionId,
      action: suggestionFeedback.action,
      originalText: suggestionFeedback.originalText,
      finalText: suggestionFeedback.finalText,
      channelId: suggestionFeedback.channelId,
      createdAt: suggestionFeedback.createdAt,
    })
    .from(suggestionFeedback)
    .where(
      and(
        eq(suggestionFeedback.workspaceId, session.workspaceId),
        eq(suggestionFeedback.userId, session.userId)
      )
    )
    .orderBy(desc(suggestionFeedback.createdAt))
    .limit(limit);
});

/**
 * Get feedback stats by action type
 */
export const getSuggestionFeedbackStats = cache(async () => {
  const session = await verifySession();

  const stats = await db
    .select({
      action: suggestionFeedback.action,
      count: count(),
    })
    .from(suggestionFeedback)
    .where(
      and(
        eq(suggestionFeedback.workspaceId, session.workspaceId),
        eq(suggestionFeedback.userId, session.userId)
      )
    )
    .groupBy(suggestionFeedback.action);

  return stats;
});

/**
 * Get all conversation contexts for user
 */
export const getConversationContexts = cache(async () => {
  const session = await verifySession();

  return db
    .select()
    .from(conversationContext)
    .where(
      and(
        eq(conversationContext.workspaceId, session.workspaceId),
        eq(conversationContext.userId, session.userId)
      )
    )
    .orderBy(desc(conversationContext.updatedAt));
});

/**
 * Get context for a specific channel
 */
export const getConversationContext = cache(async (channelId: string) => {
  const session = await verifySession();

  const [context] = await db
    .select()
    .from(conversationContext)
    .where(
      and(
        eq(conversationContext.workspaceId, session.workspaceId),
        eq(conversationContext.userId, session.userId),
        eq(conversationContext.channelId, channelId)
      )
    )
    .limit(1);

  return context || null;
});

/**
 * Get auto-respond log for user
 */
export const getAutoRespondLog = cache(async (limit = 50) => {
  const session = await verifySession();

  return db
    .select()
    .from(autoRespondLog)
    .where(
      and(
        eq(autoRespondLog.workspaceId, session.workspaceId),
        eq(autoRespondLog.userId, session.userId)
      )
    )
    .orderBy(desc(autoRespondLog.sentAt))
    .limit(limit);
});
