import { db, suggestionFeedback } from '@slack-speak/database';
import { logger } from '../utils/logger.js';
import { recordUserAction } from './suggestion-metrics.js';

interface TrackFeedbackParams {
  workspaceId: string;
  userId: string;
  suggestionId: string;
  action: 'accepted' | 'refined' | 'dismissed' | 'sent' | 'liked' | 'disliked';
  originalText?: string;
  finalText?: string;
  triggerContext?: string;
  channelId?: string;
}

/**
 * Track suggestion feedback action
 * Handles duplicates gracefully via upsert
 */
export async function trackFeedback(params: TrackFeedbackParams): Promise<void> {
  try {
    await db.insert(suggestionFeedback).values({
      workspaceId: params.workspaceId,
      userId: params.userId,
      suggestionId: params.suggestionId,
      action: params.action,
      originalText: params.originalText,
      finalText: params.finalText,
      triggerContext: params.triggerContext,
      channelId: params.channelId,
    }).onConflictDoUpdate({
      target: [suggestionFeedback.suggestionId, suggestionFeedback.action],
      set: {
        finalText: params.finalText,
      },
    });

    // Record user action in metrics
    recordUserAction({
      suggestionId: params.suggestionId,
      action: params.action,
    }).catch(() => {});

    logger.info({
      suggestionId: params.suggestionId,
      action: params.action,
      userId: params.userId,
    }, 'Suggestion feedback tracked');
  } catch (error) {
    logger.error({ error, params }, 'Failed to track suggestion feedback');
    // Don't throw - feedback tracking shouldn't break the main flow
  }
}

/**
 * Track when user accepts suggestion without modification (clicks Copy)
 */
export async function trackAcceptance(
  workspaceId: string,
  userId: string,
  suggestionId: string,
  suggestionText: string,
  channelId?: string
): Promise<void> {
  await trackFeedback({
    workspaceId,
    userId,
    suggestionId,
    action: 'accepted',
    originalText: suggestionText,
    finalText: suggestionText, // Same as original - no modification
    channelId,
  });
}

/**
 * Track when user refines and then accepts
 */
export async function trackRefinement(
  workspaceId: string,
  userId: string,
  suggestionId: string,
  originalText: string,
  refinedText: string,
  channelId?: string
): Promise<void> {
  await trackFeedback({
    workspaceId,
    userId,
    suggestionId,
    action: 'refined',
    originalText,
    finalText: refinedText,
    channelId,
  });
}

/**
 * Track when user dismisses suggestion
 */
export async function trackDismissal(
  workspaceId: string,
  userId: string,
  suggestionId: string,
  suggestionText?: string,
  channelId?: string
): Promise<void> {
  await trackFeedback({
    workspaceId,
    userId,
    suggestionId,
    action: 'dismissed',
    originalText: suggestionText,
    channelId,
  });
}
