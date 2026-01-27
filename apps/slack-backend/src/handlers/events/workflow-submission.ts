import type { App } from '@slack/bolt';
import { db, workflowConfig, googleIntegrations, workspaces } from '@slack-speak/database';
import { eq, and } from 'drizzle-orm';
import { queueSheetsWrite } from '../../jobs/queues.js';
import { logger } from '../../utils/logger.js';

export function registerWorkflowSubmissionHandler(app: App): void {
  app.event('message', async ({ event }) => {
    // Only process bot messages (workflow submissions are posted by a bot)
    if ((event as any).subtype !== 'bot_message' || !(event as any).bot_id) {
      return;
    }

    const botMessage = event as any;
    const channelId = botMessage.channel;
    const botId = botMessage.bot_id;

    // Find any workflow configs monitoring this channel
    const configs = await db
      .select({
        config: workflowConfig,
        workspace: workspaces,
        googleIntegration: googleIntegrations,
      })
      .from(workflowConfig)
      .innerJoin(workspaces, eq(workflowConfig.workspaceId, workspaces.id))
      .leftJoin(googleIntegrations, and(
        eq(googleIntegrations.workspaceId, workflowConfig.workspaceId),
        eq(googleIntegrations.userId, workflowConfig.userId)
      ))
      .where(
        and(
          eq(workflowConfig.channelId, channelId),
          eq(workflowConfig.enabled, true)
        )
      );

    if (configs.length === 0) return;

    // Parse workflow submission from message blocks
    const submission = parseWorkflowSubmission(botMessage);
    if (!submission) {
      logger.debug({ channelId, botId }, 'Message is not a workflow submission');
      return;
    }

    // Queue write for each config owner who has Google connected
    for (const { config, googleIntegration } of configs) {
      if (!googleIntegration?.spreadsheetId) {
        logger.debug({
          configId: config.id,
          userId: config.userId,
        }, 'Skipping - no Google Sheets configured');
        continue;
      }

      // If this is first submission from this bot, store the bot_id
      if (!config.workflowBotId) {
        await db
          .update(workflowConfig)
          .set({ workflowBotId: botId, updatedAt: new Date() })
          .where(eq(workflowConfig.id, config.id));
      }

      // Queue the write operation
      await queueSheetsWrite({
        workspaceId: config.workspaceId,
        userId: config.userId,
        spreadsheetId: googleIntegration.spreadsheetId,
        submission: {
          timestamp: new Date(parseFloat(botMessage.ts) * 1000).toISOString(),
          submitterName: submission.submitterName,
          submitterSlackId: submission.submitterSlackId,
          achievements: submission.achievements,
          focus: submission.focus,
          blockers: submission.blockers,
          shoutouts: submission.shoutouts,
        },
      });

      logger.info({
        configId: config.id,
        userId: config.userId,
        submitter: submission.submitterName,
      }, 'Queued workflow submission write');
    }
  });
}

interface ParsedSubmission {
  submitterName: string;
  submitterSlackId: string;
  achievements: string;
  focus: string;
  blockers: string;
  shoutouts: string;
}

function parseWorkflowSubmission(message: any): ParsedSubmission | null {
  const blocks = message.blocks || [];

  // Workflow forms typically have specific structure with section blocks
  // containing field labels and rich_text with values
  // This is a heuristic parser - may need adjustment based on actual workflow structure

  const fields: Record<string, string> = {};

  for (const block of blocks) {
    if (block.type === 'section' && block.text) {
      const text = block.text.text || '';
      // Look for patterns like "*Achievements*\nContent here"
      const match = text.match(/\*([^*]+)\*\n?(.*)/s);
      if (match) {
        const label = match[1].toLowerCase();
        const value = match[2].trim();
        fields[label] = value;
      }
    }
    if (block.type === 'rich_text') {
      // Handle rich text blocks
      for (const element of block.elements || []) {
        if (element.type === 'rich_text_section') {
          const textParts = element.elements
            ?.filter((e: any) => e.type === 'text')
            .map((e: any) => e.text)
            .join('');
          if (textParts) {
            // Try to extract label: value pairs
            const labelMatch = textParts.match(/^([^:]+):\s*(.*)$/s);
            if (labelMatch) {
              fields[labelMatch[1].toLowerCase()] = labelMatch[2].trim();
            }
          }
        }
      }
    }
  }

  // Check if we have minimum required fields
  const hasRequiredFields =
    fields['achievements'] || fields['accomplishments'] ||
    fields['focus'] || fields['next week'] ||
    fields['blockers'] || fields['challenges'];

  if (!hasRequiredFields) {
    return null;
  }

  // Extract submitter info from message metadata or username
  const submitterName = message.username || 'Unknown';
  const submitterSlackId = message.user || message.bot_id || '';

  return {
    submitterName,
    submitterSlackId,
    achievements: fields['achievements'] || fields['accomplishments'] || '',
    focus: fields['focus'] || fields['next week'] || '',
    blockers: fields['blockers'] || fields['challenges'] || '',
    shoutouts: fields['shoutouts'] || fields['kudos'] || '',
  };
}
