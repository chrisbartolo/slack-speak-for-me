import type { App } from '@slack/bolt';
import { recordSurveyResponse } from '../../services/index.js';
import { db, satisfactionSurveys } from '@slack-speak/database';
import { eq } from 'drizzle-orm';
import { logger } from '../../utils/logger.js';

/**
 * Register Slack action handlers for satisfaction survey interactions
 */
export function registerSatisfactionSurveyActions(app: App): void {
  // Handle submit button click
  app.action('submit_satisfaction_survey', async ({ ack, body, client, action }) => {
    await ack();

    try {
      // Extract surveyId from button value
      const surveyId = 'value' in action ? action.value : '';
      if (!surveyId) {
        logger.warn('No surveyId in submit_satisfaction_survey action');
        return;
      }

      // Extract rating from radio buttons state
      const stateValues = 'state' in body && body.state && typeof body.state !== 'string' ? body.state.values : {};
      const surveyBlockId = `satisfaction_survey_${surveyId}`;
      const ratingBlock = stateValues[surveyBlockId];

      if (!ratingBlock || !ratingBlock['satisfaction_rating']) {
        logger.warn({ surveyId }, 'No rating selected in survey submission');
        await client.chat.postEphemeral({
          channel: 'channel' in body && body.channel ? body.channel.id || '' : '',
          user: 'user' in body && body.user ? body.user.id || '' : '',
          text: 'Please select a rating before submitting.',
        });
        return;
      }

      const selectedOption = ratingBlock['satisfaction_rating'].selected_option;
      if (!selectedOption || !selectedOption.value) {
        logger.warn({ surveyId }, 'Invalid rating option selected');
        return;
      }

      const rating = parseInt(selectedOption.value, 10);

      // Extract optional feedback text
      const feedbackBlock = stateValues['satisfaction_feedback'];
      const feedbackText = feedbackBlock?.['feedback_text']?.value || undefined;

      // Record the response
      await recordSurveyResponse(surveyId, rating, feedbackText);

      // Update the original message to show confirmation
      if ('message' in body && body.message && 'channel' in body && body.channel) {
        await client.chat.update({
          channel: body.channel.id || '',
          ts: body.message.ts || '',
          text: 'Thank you for your feedback!',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '✅ *Thank you for your feedback!*\n\nYour response has been recorded.',
              },
            },
          ],
        });
      }

      logger.info({ surveyId, rating, hasFeedback: !!feedbackText }, 'Survey submitted successfully');
    } catch (error) {
      logger.error({ error }, 'Error handling survey submission');
    }
  });

  // Handle dismiss button click
  app.action('dismiss_satisfaction_survey', async ({ ack, body, client, action }) => {
    await ack();

    try {
      // Extract surveyId from button value
      const surveyId = 'value' in action ? action.value : '';
      if (!surveyId) {
        logger.warn('No surveyId in dismiss_satisfaction_survey action');
        return;
      }

      // Update survey status to dismissed
      await db
        .update(satisfactionSurveys)
        .set({ status: 'dismissed' })
        .where(eq(satisfactionSurveys.id, surveyId));

      // Update the original message to show dismissal
      if ('message' in body && body.message && 'channel' in body && body.channel) {
        await client.chat.update({
          channel: body.channel.id || '',
          ts: body.message.ts || '',
          text: 'Survey dismissed',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '_Survey dismissed_',
              },
            },
          ],
        });
      }

      logger.info({ surveyId }, 'Survey dismissed');
    } catch (error) {
      logger.error({ error }, 'Error handling survey dismissal');
    }
  });

  // Handle radio button interaction (requires acknowledgment)
  app.action('satisfaction_rating', async ({ ack }) => {
    await ack();
    // No action needed - the submit button handles recording
  });
}
