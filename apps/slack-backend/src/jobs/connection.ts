import { Redis } from 'ioredis';
import { env } from '../env.js';
import pino from 'pino';

const logger = pino({ name: 'redis' });

// Support both REDIS_URL (full connection string) and REDIS_HOST/PORT
export const redis = env.REDIS_URL
  ? new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // Required for BullMQ
    })
  : new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      maxRetriesPerRequest: null, // Required for BullMQ
      tls: env.REDIS_TLS ? {} : undefined,
    });

redis.on('error', (err: Error) => {
  logger.error({ err }, 'Redis connection error');
});

redis.on('ready', () => {
  logger.info('Redis connected');
});
