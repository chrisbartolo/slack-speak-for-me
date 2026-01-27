import { Worker, Job } from 'bullmq';
import { redis } from './connection.js';
import type { AIResponseJobData, AIResponseJobResult, SheetsWriteJobData, SheetsWriteJobResult, ReportGenerationJobData, ReportGenerationJobResult } from './types.js';
import { generateSuggestion, sendSuggestionEphemeral, appendSubmission, generateWeeklyReport } from '../services/index.js';
import { logger } from '../utils/logger.js';
import { db, workspaces, installations, decrypt } from '@slack-speak/database';
import { eq } from 'drizzle-orm';
import { getEncryptionKey } from '../env.js';
import { WebClient } from '@slack/web-api';

let aiResponseWorker: Worker<AIResponseJobData, AIResponseJobResult> | null = null;
let sheetsWorker: Worker<SheetsWriteJobData, SheetsWriteJobResult> | null = null;
let reportWorker: Worker<ReportGenerationJobData, ReportGenerationJobResult> | null = null;

export async function startWorkers() {
  aiResponseWorker = new Worker<AIResponseJobData, AIResponseJobResult>(
    'ai-responses',
    async (job: Job<AIResponseJobData>) => {
      const { workspaceId, userId, channelId, messageTs, triggerMessageText, contextMessages, triggeredBy } = job.data;

      logger.info({
        jobId: job.id,
        workspaceId,
        userId,
        triggeredBy,
      }, 'Processing AI response job');

      const result = await generateSuggestion({
        workspaceId,
        userId,
        triggerMessage: triggerMessageText,
        contextMessages,
        triggeredBy,
      });

      // Generate a unique suggestion ID for tracking
      const suggestionId = `sug_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      logger.info({
        jobId: job.id,
        suggestionId,
        processingTimeMs: result.processingTimeMs,
      }, 'AI suggestion generated successfully');

      // Fetch installation to get bot token for delivery
      try {
        const [installation] = await db
          .select({
            installation: installations,
            workspace: workspaces,
          })
          .from(installations)
          .innerJoin(workspaces, eq(installations.workspaceId, workspaces.id))
          .where(eq(workspaces.id, workspaceId))
          .limit(1);

        if (!installation) {
          logger.error({ workspaceId }, 'Installation not found for workspace');
          // Don't throw - suggestion was generated successfully
          return {
            suggestionId,
            suggestion: result.suggestion,
            processingTimeMs: result.processingTimeMs,
          };
        }

        // Decrypt bot token
        const encryptionKey = getEncryptionKey();
        const botToken = decrypt(installation.installation.botToken, encryptionKey);

        // Create WebClient for ephemeral message delivery
        const client = new WebClient(botToken);

        // Send ephemeral message with suggestion
        await sendSuggestionEphemeral({
          client,
          channelId,
          userId,
          suggestionId,
          suggestion: result.suggestion,
          triggerContext: triggeredBy,
        });

        logger.info({
          jobId: job.id,
          suggestionId,
          channelId,
          userId,
        }, 'Suggestion delivered successfully');
      } catch (deliveryError) {
        // Log delivery failure but don't throw - suggestion was still generated
        logger.error({
          error: deliveryError,
          jobId: job.id,
          suggestionId,
        }, 'Failed to deliver suggestion (generation succeeded)');
      }

      return {
        suggestionId,
        suggestion: result.suggestion,
        processingTimeMs: result.processingTimeMs,
      };
    },
    {
      connection: redis,
      concurrency: 5, // Process 5 jobs in parallel per worker instance
      limiter: {
        max: 10, // Max 10 jobs per duration
        duration: 1000, // Per 1 second
      },
    }
  );

  // Critical: Attach error listeners to prevent crashes
  aiResponseWorker.on('error', (err: Error) => {
    logger.error({ err }, 'Worker error');
  });

  aiResponseWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message, attempts: job?.attemptsMade }, 'Job failed');
  });

  aiResponseWorker.on('completed', (job, result) => {
    logger.info({
      jobId: job.id,
      suggestionId: result.suggestionId,
      processingTimeMs: result.processingTimeMs,
    }, 'Job completed');
  });

  aiResponseWorker.on('stalled', (jobId) => {
    logger.warn({ jobId }, 'Job stalled - will be retried');
  });

  logger.info('AI response worker started');

  // Sheets worker
  sheetsWorker = new Worker<SheetsWriteJobData, SheetsWriteJobResult>(
    'sheets-writes',
    async (job) => {
      const { workspaceId, userId, spreadsheetId, submission } = job.data;

      await appendSubmission(workspaceId, userId, spreadsheetId, {
        timestamp: new Date(submission.timestamp),
        submitterName: submission.submitterName,
        submitterSlackId: submission.submitterSlackId,
        achievements: submission.achievements,
        focus: submission.focus,
        blockers: submission.blockers,
        shoutouts: submission.shoutouts,
      });

      return { success: true };
    },
    {
      connection: redis,
      concurrency: 1, // One at a time to avoid rate limits per spreadsheet
      limiter: {
        max: 30, // Max 30 writes per minute (well under 60/min limit)
        duration: 60000,
      },
    }
  );

  sheetsWorker.on('error', (err) => logger.error({ err }, 'Sheets worker error'));
  sheetsWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err: err.message }, 'Sheets job failed'));
  sheetsWorker.on('completed', (job) => logger.info({ jobId: job.id }, 'Sheets job completed'));

  logger.info('Sheets worker started');

  // Report generation worker
  reportWorker = new Worker<ReportGenerationJobData, ReportGenerationJobResult>(
    'report-generation',
    async (job) => {
      const { workspaceId, userId, spreadsheetId, responseUrl, weekStartDate } = job.data;

      logger.info({
        jobId: job.id,
        workspaceId,
        userId,
      }, 'Processing report generation job');

      try {
        const result = await generateWeeklyReport({
          workspaceId,
          userId,
          spreadsheetId,
          weekStartDate: weekStartDate ? new Date(weekStartDate) : undefined,
        });

        // Fetch installation for DM delivery
        const [installation] = await db
          .select({
            installation: installations,
            workspace: workspaces,
          })
          .from(installations)
          .innerJoin(workspaces, eq(installations.workspaceId, workspaces.id))
          .where(eq(workspaces.id, workspaceId))
          .limit(1);

        if (!installation) {
          throw new Error('Installation not found for workspace');
        }

        // Decrypt bot token
        const encryptionKey = getEncryptionKey();
        const botToken = decrypt(installation.installation.botToken, encryptionKey);
        const client = new WebClient(botToken);

        // Format report with Block Kit
        const blocks: any[] = [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '📊 Weekly Report',
              emoji: true,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: result.report,
            },
          },
        ];

        // Add missing submitters section if any
        if (result.missingSubmitters.length > 0) {
          blocks.push({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `⚠️ *Missing submissions:* ${result.missingSubmitters.join(', ')}`,
            },
          });
        }

        blocks.push({
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Generated in ${result.processingTimeMs}ms | Use \`/generate-report\` to create a new report`,
            },
          ],
        });

        // Send DM to user
        await client.chat.postMessage({
          channel: userId,
          text: 'Your weekly report is ready!',
          blocks,
        });

        // If responseUrl is provided (from slash command), acknowledge success
        if (responseUrl) {
          await fetch(responseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: '✅ Report generated and sent to your DMs!',
              response_type: 'ephemeral',
            }),
          });
        }

        logger.info({
          jobId: job.id,
          userId,
          processingTimeMs: result.processingTimeMs,
        }, 'Report generated and delivered');

        return {
          success: true,
          report: result.report,
          missingSubmitters: result.missingSubmitters,
          processingTimeMs: result.processingTimeMs,
        };
      } catch (error) {
        logger.error({ error, jobId: job.id }, 'Failed to generate report');

        // Try to send error response if responseUrl available
        if (responseUrl) {
          try {
            await fetch(responseUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: '❌ Failed to generate report. Please try again later.',
                response_type: 'ephemeral',
              }),
            });
          } catch (responseError) {
            logger.error({ error: responseError }, 'Failed to send error response');
          }
        }

        throw error;
      }
    },
    {
      connection: redis,
      concurrency: 2,
      limiter: {
        max: 5, // Max 5 reports per minute
        duration: 60000,
      },
    }
  );

  reportWorker.on('error', (err) => logger.error({ err }, 'Report worker error'));
  reportWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err: err.message }, 'Report job failed'));
  reportWorker.on('completed', (job) => logger.info({ jobId: job.id }, 'Report job completed'));

  logger.info('Report worker started');
}

export async function stopWorkers() {
  if (aiResponseWorker) {
    await aiResponseWorker.close();
    aiResponseWorker = null;
    logger.info('AI response worker stopped');
  }
  if (sheetsWorker) {
    await sheetsWorker.close();
    sheetsWorker = null;
    logger.info('Sheets worker stopped');
  }
  if (reportWorker) {
    await reportWorker.close();
    reportWorker = null;
    logger.info('Report worker stopped');
  }
}
