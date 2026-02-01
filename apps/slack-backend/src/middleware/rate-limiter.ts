import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { Redis } from 'ioredis';
import { env } from '../env.js';
import pino from 'pino';

const logger = pino({ name: 'rate-limiter' });

/**
 * Create a Redis client for rate limiting.
 * Uses REDIS_URL if available, otherwise REDIS_HOST/PORT.
 * TLS is enabled for production Redis instances.
 */
function createRedisClient(): Redis | null {
  try {
    const redis = env.REDIS_URL
      ? new Redis(env.REDIS_URL, {
          enableOfflineQueue: false,
        })
      : new Redis({
          host: env.REDIS_HOST,
          port: env.REDIS_PORT,
          tls: env.REDIS_TLS ? {} : undefined,
          enableOfflineQueue: false,
        });

    redis.on('error', (err: Error) => {
      logger.error({ err }, 'Rate limiter Redis connection error');
    });

    redis.on('ready', () => {
      logger.info('Rate limiter Redis connected');
    });

    return redis;
  } catch (err) {
    logger.warn({ err }, 'Failed to create Redis client for rate limiting, using memory store');
    return null;
  }
}

const redisClient = createRedisClient();

/**
 * Create a rate limiter with Redis store (or memory fallback).
 */
function createRateLimiter(options: {
  windowMs: number;
  max: number;
  prefix: string;
  message: { error: string };
}): RateLimitRequestHandler {
  const store = redisClient
    ? new RedisStore({
        // @ts-expect-error - ioredis call() has compatible signature with rate-limit-redis
        sendCommand: (command: string, ...args: string[]) => redisClient.call(command, ...args),
        prefix: options.prefix,
      })
    : undefined;

  if (!redisClient) {
    logger.warn(`Rate limiter "${options.prefix}" using memory store (not distributed)`);
  }

  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    store,
    message: options.message,
    handler: (req, res, _next, optionsUsed) => {
      logger.warn({
        ip: req.ip,
        path: req.path,
        prefix: options.prefix,
      }, 'Rate limit exceeded');
      res.status(optionsUsed.statusCode).json(optionsUsed.message);
    },
  });
}

/**
 * General API rate limiter.
 * 100 requests per 15 minutes per IP.
 */
export const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  prefix: 'rl:api:',
  message: { error: 'Too many requests, please try again later.' },
});

/**
 * Auth rate limiter for OAuth endpoints.
 * 10 attempts per hour per IP.
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  prefix: 'rl:auth:',
  message: { error: 'Too many authentication attempts.' },
});

/**
 * GDPR rate limiter for data export/deletion endpoints.
 * 5 requests per 24 hours per IP.
 */
export const gdprRateLimiter = createRateLimiter({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5,
  prefix: 'rl:gdpr:',
  message: { error: 'Data export/deletion limit reached. Try again tomorrow.' },
});
