import { Queue } from 'bullmq';
import { redis } from './connection.js';
import type { AIResponseJobData, SheetsWriteJobData } from './types.js';

export const aiResponseQueue = new Queue<AIResponseJobData>('ai-responses', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000, // Start at 2s, then 4s, then 8s
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
      count: 500, // Keep last 500 failed jobs for debugging
    },
  },
});

export async function queueAIResponse(
  data: AIResponseJobData,
  options?: { priority?: number; delay?: number }
) {
  return aiResponseQueue.add('generate-suggestion', data, {
    priority: options?.priority,
    delay: options?.delay,
  });
}

export const sheetsQueue = new Queue<SheetsWriteJobData>('sheets-writes', {
  connection: redis,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

export async function queueSheetsWrite(data: SheetsWriteJobData) {
  return sheetsQueue.add('append-submission', data);
}
