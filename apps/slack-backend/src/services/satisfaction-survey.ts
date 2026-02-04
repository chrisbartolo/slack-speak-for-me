import crypto from 'node:crypto';
import { WebClient } from '@slack/web-api';
import { db, satisfactionSurveys } from '@slack-speak/database';
import { desc, eq, and, lt, sql } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import type { Block, KnownBlock } from '@slack/types';

/**
 * Build Slack Block Kit blocks for NPS satisfaction survey
 */
export function buildSurveyBlocks(surveyId: string): (Block | KnownBlock)[] {
  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'Quick Feedback',
      },
    },
    {
      type: 'section',
      text: {
        type: 'plain_text',
        text: 'On a scale from 0 to 10, how likely are you to recommend Slack Speak for Me to a colleague?',
      },
    },
    {
      type: 'actions',
      block_id: `satisfaction_survey_${surveyId}`,
      elements: [
        {
          type: 'radio_buttons',
          action_id: 'satisfaction_rating',
          options: [
            { text: { type: 'plain_text', text: '0' }, value: '0' },
            { text: { type: 'plain_text', text: '1' }, value: '1' },
            { text: { type: 'plain_text', text: '2' }, value: '2' },
            { text: { type: 'plain_text', text: '3' }, value: '3' },
            { text: { type: 'plain_text', text: '4' }, value: '4' },
            { text: { type: 'plain_text', text: '5' }, value: '5' },
            { text: { type: 'plain_text', text: '6' }, value: '6' },
            { text: { type: 'plain_text', text: '7' }, value: '7' },
            { text: { type: 'plain_text', text: '8' }, value: '8' },
            { text: { type: 'plain_text', text: '9' }, value: '9' },
            { text: { type: 'plain_text', text: '10' }, value: '10' },
          ],
        },
      ],
    },
    {
      type: 'context',
      elements: [
        {
          type: 'plain_text',
          text: '0 = Not at all likely  |  10 = Extremely likely',
        },
      ],
    },
    {
      type: 'input',
      block_id: 'satisfaction_feedback',
      optional: true,
      element: {
        type: 'plain_text_input',
        action_id: 'feedback_text',
        multiline: true,
        max_length: 500,
        placeholder: {
          type: 'plain_text',
          text: 'Optional: What can we improve?',
        },
      },
      label: {
        type: 'plain_text',
        text: 'Feedback',
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          action_id: 'submit_satisfaction_survey',
          text: {
            type: 'plain_text',
            text: 'Submit',
          },
          style: 'primary',
          value: surveyId,
        },
        {
          type: 'button',
          action_id: 'dismiss_satisfaction_survey',
          text: {
            type: 'plain_text',
            text: 'Dismiss',
          },
          value: surveyId,
        },
      ],
    },
  ];
}

/**
 * Categorize NPS rating into promoter/passive/detractor
 */
export function categorizeNPS(rating: number): 'promoter' | 'passive' | 'detractor' {
  if (rating >= 9) return 'promoter';
  if (rating >= 7) return 'passive';
  return 'detractor';
}

/**
 * Check if a user can be surveyed (30-day frequency cap)
 */
export async function canSurveyUser(workspaceId: string, userId: string): Promise<boolean> {
  try {
    const recentSurveys = await db
      .select()
      .from(satisfactionSurveys)
      .where(
        and(
          eq(satisfactionSurveys.workspaceId, workspaceId),
          eq(satisfactionSurveys.userId, userId)
        )
      )
      .orderBy(desc(satisfactionSurveys.deliveredAt))
      .limit(1);

    if (recentSurveys.length === 0) {
      return true; // No previous survey
    }

    const lastSurvey = recentSurveys[0];
    const daysSinceLastSurvey = (Date.now() - lastSurvey.deliveredAt.getTime()) / (1000 * 60 * 60 * 24);

    return daysSinceLastSurvey >= 30;
  } catch (error) {
    logger.warn({ error, workspaceId, userId }, 'Error checking survey eligibility');
    return false; // Fail safe - don't survey on error
  }
}

/**
 * Deliver an NPS survey to a user via Slack DM
 * Returns surveyId if delivered, null if user not eligible
 */
export async function deliverSurvey(
  client: WebClient,
  workspaceId: string,
  organizationId: string,
  userId: string
): Promise<string | null> {
  try {
    // Check eligibility first
    const eligible = await canSurveyUser(workspaceId, userId);
    if (!eligible) {
      logger.debug({ workspaceId, userId }, 'User not eligible for survey (too soon)');
      return null;
    }

    // Generate unique survey ID
    const surveyId = crypto.randomUUID();

    // Insert survey record
    const [survey] = await db
      .insert(satisfactionSurveys)
      .values({
        organizationId,
        workspaceId,
        userId,
        surveyType: 'nps',
        status: 'delivered',
        deliveredAt: new Date(),
      })
      .returning();

    // Send DM with survey blocks
    const result = await client.chat.postMessage({
      channel: userId,
      text: 'Quick feedback request',
      blocks: buildSurveyBlocks(survey.id),
    });

    // Update record with Slack message timestamp
    if (result.ts) {
      await db
        .update(satisfactionSurveys)
        .set({ slackMessageTs: result.ts })
        .where(eq(satisfactionSurveys.id, survey.id));
    }

    logger.info({ surveyId: survey.id, workspaceId, userId }, 'Survey delivered');
    return survey.id;
  } catch (error) {
    logger.warn({ error, workspaceId, userId }, 'Failed to deliver survey');
    return null;
  }
}

/**
 * Record a survey response (rating and optional feedback)
 */
export async function recordSurveyResponse(
  surveyId: string,
  rating: number,
  feedbackText?: string
): Promise<void> {
  try {
    const npsCategory = categorizeNPS(rating);

    await db
      .update(satisfactionSurveys)
      .set({
        rating,
        npsCategory,
        feedbackText: feedbackText || null,
        status: 'completed',
        respondedAt: new Date(),
      })
      .where(eq(satisfactionSurveys.id, surveyId));

    logger.info({ surveyId, rating, npsCategory, hasFeedback: !!feedbackText }, 'Survey response recorded');
  } catch (error) {
    logger.error({ error, surveyId }, 'Failed to record survey response');
    throw error;
  }
}

/**
 * Expire old surveys that haven't been answered (7+ days old)
 * Returns count of expired surveys
 */
export async function expireOldSurveys(): Promise<number> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const result = await db
      .update(satisfactionSurveys)
      .set({
        status: 'expired',
        expiredAt: new Date(),
      })
      .where(
        and(
          eq(satisfactionSurveys.status, 'delivered'),
          lt(satisfactionSurveys.deliveredAt, sevenDaysAgo)
        )
      )
      .returning({ id: satisfactionSurveys.id });

    const count = result.length;
    logger.info({ count }, 'Expired old surveys');
    return count;
  } catch (error) {
    logger.error({ error }, 'Failed to expire old surveys');
    return 0;
  }
}
