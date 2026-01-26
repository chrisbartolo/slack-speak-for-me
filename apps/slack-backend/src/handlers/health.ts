import type { IncomingMessage, ServerResponse } from 'http';
import { db } from '@slack-speak/database';
import { redis } from '../jobs/connection.js';
import { aiResponseQueue } from '../jobs/queues.js';
import { logger } from '../utils/logger.js';
import { sql } from 'drizzle-orm';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: { status: 'up' | 'down'; latencyMs?: number };
    redis: { status: 'up' | 'down'; latencyMs?: number };
    queue: {
      status: 'up' | 'down';
      waiting?: number;
      active?: number;
      failed?: number;
    };
  };
  version: string;
}

async function checkDatabase(): Promise<{ status: 'up' | 'down'; latencyMs?: number }> {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return { status: 'up', latencyMs: Date.now() - start };
  } catch (error) {
    logger.error({ err: error }, 'Database health check failed');
    return { status: 'down' };
  }
}

async function checkRedis(): Promise<{ status: 'up' | 'down'; latencyMs?: number }> {
  const start = Date.now();
  try {
    await redis.ping();
    return { status: 'up', latencyMs: Date.now() - start };
  } catch (error) {
    logger.error({ err: error }, 'Redis health check failed');
    return { status: 'down' };
  }
}

async function checkQueue(): Promise<HealthStatus['services']['queue']> {
  try {
    const [waiting, active, failed] = await Promise.all([
      aiResponseQueue.getWaitingCount(),
      aiResponseQueue.getActiveCount(),
      aiResponseQueue.getFailedCount(),
    ]);
    return { status: 'up', waiting, active, failed };
  } catch (error) {
    logger.error({ err: error }, 'Queue health check failed');
    return { status: 'down' };
  }
}

/**
 * Liveness probe handler - basic check that app is running.
 * Returns 200 if the process is alive.
 */
function handleLivenessProbe(_req: IncomingMessage, res: ServerResponse): void {
  const response = JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() });
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(response);
}

/**
 * Readiness probe handler - full check of all dependencies.
 * Returns 200 if all services are up, 503 if any service is down.
 */
async function handleReadinessProbe(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const [database, redisStatus, queue] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkQueue(),
  ]);

  const allUp = database.status === 'up' &&
                redisStatus.status === 'up' &&
                queue.status === 'up';

  const health: HealthStatus = {
    status: allUp ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: { database, redis: redisStatus, queue },
    version: process.env.npm_package_version || '0.0.1',
  };

  const statusCode = allUp ? 200 : 503;
  const response = JSON.stringify(health);
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(response);
}

/**
 * Custom routes for Bolt app health endpoints.
 * Pass these to the App constructor's customRoutes option.
 *
 * Endpoints:
 * - GET /health/live: Liveness probe (is the app running?)
 * - GET /health/ready: Readiness probe (are all dependencies healthy?)
 */
export const healthRoutes = [
  {
    path: '/health/live',
    method: 'GET',
    handler: handleLivenessProbe,
  },
  {
    path: '/health/ready',
    method: 'GET',
    handler: (req: IncomingMessage, res: ServerResponse) => {
      handleReadinessProbe(req, res).catch((error) => {
        logger.error({ err: error }, 'Readiness probe error');
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', message: 'Internal server error' }));
      });
    },
  },
];

/**
 * Log that health endpoints are registered.
 * Call this after app initialization to confirm routes are active.
 */
export function logHealthEndpointsRegistered(): void {
  logger.info('Health endpoints registered: /health/live, /health/ready');
}
