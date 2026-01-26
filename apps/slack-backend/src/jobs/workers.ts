import { Worker, Job } from 'bullmq';
import { redis } from './connection.js';
import type { AIResponseJobData, AIResponseJobResult } from './types.js';
import pino from 'pino';
import crypto from 'crypto';

const logger = pino({ name: 'worker' });

let aiResponseWorker: Worker<AIResponseJobData, AIResponseJobResult> | null = null;

export async function startWorkers() {
  aiResponseWorker = new Worker<AIResponseJobData, AIResponseJobResult>(
    'ai-responses',
    async (job: Job<AIResponseJobData>) => {
      const startTime = Date.now();
      const { workspaceId, userId, channelId, triggerMessageText, contextMessages, triggeredBy } = job.data;

      logger.info({ jobId: job.id, workspaceId, triggeredBy }, 'Processing AI response job');

      // Update progress
      await job.updateProgress(10);

      // TODO: Phase 2 will implement actual AI generation
      // For now, return placeholder
      const suggestion = `[Placeholder] AI suggestion for: "${triggerMessageText.slice(0, 50)}..."`;

      await job.updateProgress(90);

      // TODO: Phase 2 will send ephemeral message back to Slack
      logger.info({ jobId: job.id, processingTimeMs: Date.now() - startTime }, 'Job completed');

      await job.updateProgress(100);

      return {
        suggestionId: crypto.randomUUID(),
        suggestion,
        processingTimeMs: Date.now() - startTime,
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
    logger.info({ jobId: job.id, processingTimeMs: result.processingTimeMs }, 'Job completed successfully');
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
