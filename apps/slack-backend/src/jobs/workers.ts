import { Worker, Job } from 'bullmq';
import { redis } from './connection.js';
import type { AIResponseJobData, AIResponseJobResult } from './types.js';
import { generateSuggestion } from '../services/index.js';
import { logger } from '../utils/logger.js';

let aiResponseWorker: Worker<AIResponseJobData, AIResponseJobResult> | null = null;

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
}

export async function stopWorkers() {
  if (aiResponseWorker) {
    await aiResponseWorker.close();
    aiResponseWorker = null;
    logger.info('AI response worker stopped');
  }
}
