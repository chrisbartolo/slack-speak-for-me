import type { App, SlackCommandMiddlewareArgs } from '@slack/bolt';
import { db, googleIntegrations } from '@slack-speak/database';
import { eq, and } from 'drizzle-orm';
import { queueReportGeneration } from '../../jobs/queues.js';
import { logger } from '../../utils/logger.js';

/**
 * Handle /generate-report slash command
 * Queue async report generation and deliver via DM
 */
async function handleGenerateReport({ ack, command, respond }: SlackCommandMiddlewareArgs) {
  // Acknowledge immediately (3-second requirement)
  await ack();

  // Show help text if requested
  const helpText = command.text?.trim().toLowerCase();
  if (helpText === 'help') {
    await respond({
      text: '*Usage:* `/speakforme-report`\n\nGenerate your weekly standup report based on workflow submissions. Requires Google Sheets integration (configure in the web portal).\n\nThe report will be delivered to your DMs when ready.',
      response_type: 'ephemeral',
    });
    return;
  }

  const workspaceId = command.team_id;
  const userId = command.user_id;

  try {
    // Check if user has Google integration with configured spreadsheet
    const [integration] = await db
      .select()
      .from(googleIntegrations)
      .where(
        and(
          eq(googleIntegrations.workspaceId, workspaceId),
          eq(googleIntegrations.userId, userId)
        )
      )
      .limit(1);

    if (!integration) {
      await respond({
        text: '❌ No Google integration found. Please connect your Google account first via the web portal.',
        response_type: 'ephemeral',
      });
      return;
    }

    if (!integration.spreadsheetId) {
      await respond({
        text: '❌ No spreadsheet configured. Please set up your report spreadsheet in the web portal first.',
        response_type: 'ephemeral',
      });
      return;
    }

    // Queue report generation job
    await queueReportGeneration({
      workspaceId,
      userId,
      spreadsheetId: integration.spreadsheetId,
      responseUrl: command.response_url,
    });

    await respond({
      text: '✅ Generating your weekly report... I\'ll send it to your DMs when ready!',
      response_type: 'ephemeral',
    });

    logger.info({
      workspaceId,
      userId,
      spreadsheetId: integration.spreadsheetId,
    }, 'Report generation queued');
  } catch (error) {
    logger.error({ error, workspaceId, userId }, 'Failed to queue report generation');

    await respond({
      text: '❌ Failed to queue report generation. Please try again later.',
      response_type: 'ephemeral',
    });
  }
}

/**
 * Register /generate-report command with the Bolt app
 */
export function registerGenerateReportCommand(app: App) {
  app.command('/speakforme-report', handleGenerateReport);
}
