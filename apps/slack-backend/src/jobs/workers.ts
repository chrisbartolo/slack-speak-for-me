import { Worker, Job } from 'bullmq';
import { redis } from './connection.js';
import type { AIResponseJobData, AIResponseJobResult, SheetsWriteJobData, SheetsWriteJobResult, ReportGenerationJobData, ReportGenerationJobResult, UsageReporterJobData, UsageReporterJobResult, KBIndexJobData, KBIndexJobResult, EscalationScanJobData, EscalationScanJobResult, DataRetentionJobData, DataRetentionJobResult, TrendAggregationJobData, TrendAggregationJobResult } from './types.js';
import { generateSuggestion, sendSuggestionEphemeral, postToUser, appendSubmission, generateWeeklyReport, isAutoRespondEnabled, logAutoResponse, checkUsageAllowed, getUsageStatus, reportUnreportedUsageBatch, indexDocument, classifyTopic, analyzeSentiment, aggregateDailyTrends } from '../services/index.js';
import { routeDelivery } from '../services/delivery-router.js';
import { logger } from '../utils/logger.js';
import { db, workspaces, installations, topicClassifications, decrypt } from '@slack-speak/database';
import { eq } from 'drizzle-orm';
import { getEncryptionKey } from '../env.js';
import { WebClient } from '@slack/web-api';
import { scanForEscalations } from './escalation-scanner.js';
import { processDataRetention } from './data-retention.js';
import { recordAIStarted, recordAICompleted, recordDelivered, recordError } from '../services/suggestion-metrics.js';

let aiResponseWorker: Worker<AIResponseJobData, AIResponseJobResult> | null = null;
let sheetsWorker: Worker<SheetsWriteJobData, SheetsWriteJobResult> | null = null;
let reportWorker: Worker<ReportGenerationJobData, ReportGenerationJobResult> | null = null;
let usageReporterWorker: Worker<UsageReporterJobData, UsageReporterJobResult> | null = null;
let kbIndexWorker: Worker<KBIndexJobData, KBIndexJobResult> | null = null;
let escalationScanWorker: Worker<EscalationScanJobData, EscalationScanJobResult> | null = null;
let dataRetentionWorker: Worker<DataRetentionJobData, DataRetentionJobResult> | null = null;
let trendAggregationWorker: Worker<TrendAggregationJobData, TrendAggregationJobResult> | null = null;

export async function startWorkers() {
  aiResponseWorker = new Worker<AIResponseJobData, AIResponseJobResult>(
    'ai-responses',
    async (job: Job<AIResponseJobData>) => {
      const { workspaceId, suggestionId, userId, channelId, messageTs, triggerMessageText, contextMessages, triggeredBy, responseUrl } = job.data;

      logger.info({
        jobId: job.id,
        workspaceId,
        userId,
        triggeredBy,
      }, 'Processing AI response job');

      // Check usage limits before generating
      try {
        const usageCheck = await checkUsageAllowed({ workspaceId, userId });
        if (!usageCheck.allowed) {
          logger.info({
            jobId: job.id,
            workspaceId,
            userId,
            reason: usageCheck.reason,
            currentUsage: usageCheck.currentUsage,
            limit: usageCheck.limit,
          }, 'AI generation blocked by usage limit');

          // Record usage limit error
          recordError({ suggestionId, errorType: 'usage_limit' }).catch(() => {});

          // Send limit message to user
          const limitText = `You've used all ${usageCheck.limit} AI suggestions for this month. Upgrade your plan for more. Your usage resets at the start of next month.`;

          if (responseUrl && channelId.startsWith('D')) {
            // In DMs, use response_url for in-context delivery
            await fetch(responseUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: limitText,
                response_type: 'ephemeral',
                replace_original: false,
              }),
            });
          } else {
            const [inst] = await db
              .select({ installation: installations, workspace: workspaces })
              .from(installations)
              .innerJoin(workspaces, eq(installations.workspaceId, workspaces.id))
              .where(eq(workspaces.id, workspaceId))
              .limit(1);

            if (inst) {
              const encKey = getEncryptionKey();
              const token = decrypt(inst.installation.botToken, encKey);
              const limitClient = new WebClient(token);
              await postToUser(limitClient, channelId, userId, {
                text: limitText,
              });
            }
          }

          return {
            suggestionId,
            suggestion: '',
            processingTimeMs: 0,
          };
        }
      } catch (usageError) {
        // Log but don't block - fail open for UX
        logger.warn({ error: usageError, jobId: job.id }, 'Usage check failed, allowing generation');
      }

      // Record AI processing started
      recordAIStarted({ suggestionId }).catch(() => {});

      const result = await generateSuggestion({
        workspaceId,
        userId,
        channelId,
        triggerMessage: triggerMessageText,
        contextMessages,
        triggeredBy,
      });

      // Record AI processing completed
      recordAICompleted({ suggestionId, aiProcessingMs: result.processingTimeMs }).catch(() => {});

      // Fire-and-forget: Classify topic + sentiment (NEVER blocks delivery)
      classifyTopic({
        conversationMessages: contextMessages.map(m => ({ text: m.text, ts: m.ts })),
        targetMessage: triggerMessageText,
      }).then(async (classification) => {
        try {
          // Resolve organizationId (reuse from suggestion-metrics pattern)
          const [ws] = await db
            .select({ organizationId: workspaces.organizationId })
            .from(workspaces)
            .where(eq(workspaces.id, workspaceId))
            .limit(1);

          const orgId = ws?.organizationId ?? '00000000-0000-0000-0000-000000000000';

          // Step 1: Insert topic classification row (sentiment initially null)
          const [inserted] = await db.insert(topicClassifications).values({
            organizationId: orgId,
            workspaceId,
            userId,
            channelId,
            suggestionId,
            topic: classification.topic,
            confidence: Math.round(classification.confidence * 100),
            reasoning: classification.reasoning,
          }).returning({ id: topicClassifications.id });

          logger.info({
            suggestionId,
            topic: classification.topic,
            confidence: classification.confidence,
          }, 'Topic classified and stored');

          // Step 2: Fire-and-forget sentiment analysis, then UPDATE the row
          analyzeSentiment({
            conversationMessages: contextMessages.map(m => ({
              userId: m.userId,
              text: m.text,
              ts: m.ts,
            })),
            targetMessage: triggerMessageText,
          }).then(async (sentiment) => {
            try {
              await db.update(topicClassifications)
                .set({ sentiment })
                .where(eq(topicClassifications.id, inserted.id));
              logger.info({ suggestionId, tone: sentiment.tone }, 'Sentiment stored in topic classification');
            } catch (updateError) {
              logger.warn({ error: updateError, suggestionId }, 'Failed to store sentiment in topic classification');
            }
          }).catch((sentimentError) => {
            logger.warn({ error: sentimentError, suggestionId }, 'Sentiment analysis failed for topic classification');
          });
        } catch (insertError) {
          logger.warn({ error: insertError, suggestionId }, 'Failed to store topic classification');
        }
      }).catch((error) => {
        logger.warn({ error, suggestionId }, 'Topic classification failed');
      });

      // Usage already recorded inside generateSuggestion() — no duplicate here

      // Get usage status for display
      let usageInfo: { used: number; limit: number; warningLevel: 'safe' | 'warning' | 'critical' | 'exceeded'; planId: string } | undefined;
      try {
        const usageStatus = await getUsageStatus({ workspaceId, userId });
        usageInfo = {
          used: usageStatus.used,
          limit: usageStatus.limit,
          warningLevel: usageStatus.warningLevel === 'none' ? 'safe' : usageStatus.warningLevel,
          planId: usageStatus.planId,
        };
      } catch (statusError) {
        // Non-fatal - log but don't block delivery
        logger.warn({ error: statusError, jobId: job.id }, 'Failed to get usage status');
      }

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

        // Create WebClient for message delivery
        const client = new WebClient(botToken);

        // Check if YOLO mode (auto-respond) is enabled for this conversation
        const autoRespond = await isAutoRespondEnabled(workspaceId, userId, channelId);

        if (autoRespond) {
          // YOLO MODE: Post actual message on user's behalf
          const threadTs = job.data.threadTs;

          const postResult = await client.chat.postMessage({
            channel: channelId,
            text: result.suggestion,
            ...(threadTs && { thread_ts: threadTs }),
          });

          const responseMessageTs = postResult.ts;

          // Log the auto-response for undo capability
          const logId = await logAutoResponse({
            workspaceId,
            userId,
            channelId,
            threadTs,
            triggerMessageTs: messageTs,
            triggerMessageText: triggerMessageText,
            responseText: result.suggestion,
            responseMessageTs,
          });

          // Send undo notification to the user (DM-aware)
          await postToUser(client, channelId, userId, {
            text: `I auto-responded on your behalf. You can undo this if needed.`,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Auto-responded on your behalf:*\n>${result.suggestion.replace(/\n/g, '\n>')}`,
                },
              },
              {
                type: 'actions',
                elements: [
                  {
                    type: 'button',
                    text: {
                      type: 'plain_text',
                      text: 'Undo',
                      emoji: true,
                    },
                    style: 'danger',
                    action_id: 'undo_auto_response',
                    value: JSON.stringify({
                      logId,
                      channelId,
                      messageTs: responseMessageTs,
                    }),
                  },
                ],
              },
              {
                type: 'context',
                elements: [
                  {
                    type: 'mrkdwn',
                    text: `YOLO mode is enabled for this conversation. <${process.env.APP_URL || 'https://speakforme.ai'}/dashboard/conversations|Manage settings>`,
                  },
                ],
              },
            ],
          });

          // Record delivery after auto-response
          recordDelivered({ suggestionId }).catch(() => {});

          logger.info({
            jobId: job.id,
            suggestionId,
            logId,
            channelId,
            userId,
            mode: 'auto_respond',
          }, 'Auto-response sent (YOLO mode)');
        } else if (responseUrl && channelId.startsWith('D')) {
          // DM with response_url: post directly in the conversation via response_url
          // This works like Giphy - interaction response_url can post to any channel
          const { buildSuggestionBlocks: buildBlocks } = await import('../services/suggestion-delivery.js');
          const blocks = buildBlocks(
            suggestionId, result.suggestion, triggeredBy, usageInfo, channelId, job.data.threadTs
          );
          await fetch(responseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: 'Here\'s a suggested response for you',
              blocks,
              response_type: 'ephemeral',
              replace_original: false,
            }),
          });

          // Record delivery after response_url delivery
          recordDelivered({ suggestionId }).catch(() => {});

          logger.info({
            jobId: job.id,
            suggestionId,
            channelId,
            userId,
            mode: 'suggestion_via_response_url',
          }, 'Suggestion delivered via response_url in DM');
        } else {
          // Normal mode: Route through delivery router
          const deliveryMode = await routeDelivery({
            client,
            workspaceId,
            userId,
            channelId,
            suggestionId,
            suggestion: result.suggestion,
            triggerContext: triggeredBy,
            threadTs: job.data.threadTs,
            usageInfo,
          });

          // Record delivery after routing
          recordDelivered({ suggestionId }).catch(() => {});

          logger.info({
            jobId: job.id,
            suggestionId,
            channelId,
            userId,
            mode: deliveryMode,
          }, 'Suggestion delivered via delivery router');
        }
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

  // Usage reporter worker
  usageReporterWorker = new Worker<UsageReporterJobData, UsageReporterJobResult>(
    'usage-reporter',
    async (job) => {
      logger.info({ jobId: job.id, triggeredBy: job.data.triggeredBy }, 'Processing usage reporter job');
      const result = await reportUnreportedUsageBatch();
      logger.info({ jobId: job.id, ...result }, 'Usage reporting completed');
      return result;
    },
    {
      connection: redis,
      concurrency: 1, // Only one batch at a time
    }
  );

  usageReporterWorker.on('error', (err) => logger.error({ err }, 'Usage reporter worker error'));
  usageReporterWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err: err.message }, 'Usage reporter job failed'));
  usageReporterWorker.on('completed', (job, result) => logger.info({ jobId: job.id, ...result }, 'Usage reporter job completed'));

  logger.info('Usage reporter worker started');

  // Knowledge base indexer worker
  kbIndexWorker = new Worker<KBIndexJobData, KBIndexJobResult>(
    'kb-indexer',
    async (job) => {
      const { organizationId, title, content, category, tags, sourceUrl } = job.data;

      logger.info({
        jobId: job.id,
        organizationId,
        title,
      }, 'Processing KB index job');

      const documentId = await indexDocument({
        organizationId,
        title,
        content,
        category,
        tags,
        sourceUrl,
      });

      // Calculate number of chunks created (rough estimate based on word count)
      const wordCount = content.split(/\s+/).length;
      const chunksCreated = Math.ceil(wordCount / 450); // Approximate, actual chunking has overlap

      logger.info({
        jobId: job.id,
        documentId,
        chunksCreated,
      }, 'Document indexed successfully');

      return {
        documentId,
        chunksCreated,
      };
    },
    {
      connection: redis,
      concurrency: 2,
    }
  );

  kbIndexWorker.on('error', (err) => logger.error({ err }, 'KB index worker error'));
  kbIndexWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err: err.message }, 'KB index job failed'));
  kbIndexWorker.on('completed', (job, result) => logger.info({ jobId: job.id, ...result }, 'KB index job completed'));

  logger.info('KB index worker started');

  // Escalation scanner worker
  escalationScanWorker = new Worker<EscalationScanJobData, EscalationScanJobResult>(
    'escalation-scanner',
    async (job) => {
      logger.info({ jobId: job.id, triggeredBy: job.data.triggeredBy }, 'Processing escalation scan job');
      const result = await scanForEscalations();
      logger.info({ jobId: job.id, ...result }, 'Escalation scan completed');
      return result;
    },
    {
      connection: redis,
      concurrency: 1, // Only one scan at a time
    }
  );

  escalationScanWorker.on('error', (err) => logger.error({ err }, 'Escalation scanner worker error'));
  escalationScanWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err: err.message }, 'Escalation scanner job failed'));
  escalationScanWorker.on('completed', (job, result) => logger.info({ jobId: job.id, ...result }, 'Escalation scanner job completed'));

  logger.info('Escalation scanner worker started');

  // Data retention worker
  dataRetentionWorker = new Worker<DataRetentionJobData, DataRetentionJobResult>(
    'data-retention',
    async (job) => {
      logger.info({ jobId: job.id, triggeredBy: job.data.triggeredBy }, 'Processing data retention job');
      const result = await processDataRetention();
      logger.info({ jobId: job.id, ...result }, 'Data retention job completed');
      return result;
    },
    {
      connection: redis,
      concurrency: 1, // Only one retention job at a time
    }
  );

  dataRetentionWorker.on('error', (err) => logger.error({ err }, 'Data retention worker error'));
  dataRetentionWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err: err.message }, 'Data retention job failed'));
  dataRetentionWorker.on('completed', (job, result) => logger.info({ jobId: job.id, ...result }, 'Data retention job completed'));

  logger.info('Data retention worker started');

  // Trend aggregation worker
  trendAggregationWorker = new Worker<TrendAggregationJobData, TrendAggregationJobResult>(
    'trend-aggregation',
    async (job) => {
      logger.info({ jobId: job.id, triggeredBy: job.data.triggeredBy }, 'Processing trend aggregation job');
      const targetDate = job.data.targetDate ? new Date(job.data.targetDate) : undefined;
      const result = await aggregateDailyTrends(targetDate);
      logger.info({ jobId: job.id, ...result }, 'Trend aggregation completed');
      return result;
    },
    {
      connection: redis,
      concurrency: 1, // Only one aggregation at a time
    }
  );

  trendAggregationWorker.on('error', (err) => logger.error({ err }, 'Trend aggregation worker error'));
  trendAggregationWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err: err.message }, 'Trend aggregation job failed'));
  trendAggregationWorker.on('completed', (job, result) => logger.info({ jobId: job.id, ...result }, 'Trend aggregation job completed'));

  logger.info('Trend aggregation worker started');
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
  if (usageReporterWorker) {
    await usageReporterWorker.close();
    usageReporterWorker = null;
    logger.info('Usage reporter worker stopped');
  }
  if (kbIndexWorker) {
    await kbIndexWorker.close();
    kbIndexWorker = null;
    logger.info('KB index worker stopped');
  }
  if (escalationScanWorker) {
    await escalationScanWorker.close();
    escalationScanWorker = null;
    logger.info('Escalation scanner worker stopped');
  }
  if (dataRetentionWorker) {
    await dataRetentionWorker.close();
    dataRetentionWorker = null;
    logger.info('Data retention worker stopped');
  }
  if (trendAggregationWorker) {
    await trendAggregationWorker.close();
    trendAggregationWorker = null;
    logger.info('Trend aggregation worker stopped');
  }
}
