import { app } from './app.js'; // Importing app triggers side effects: error handler + health endpoints
import { env } from './env.js';
import { startWorkers, stopWorkers, syncAllReportSchedulers } from './jobs/index.js';
import { logger } from './utils/logger.js';

async function main() {
  try {
    // Log startup configuration (without secrets)
    logger.info({
      port: env.PORT,
      nodeEnv: env.NODE_ENV,
      redisHost: env.REDIS_HOST,
    }, 'Starting Slack Speak for Me backend');

    // Start the Bolt app
    await app.start(env.PORT);
    logger.info({ port: env.PORT }, 'Bolt app started');

    // Start background workers
    await startWorkers();
    logger.info('Background workers started');

    // Sync all report schedulers from database
    await syncAllReportSchedulers();
    logger.info('Report schedulers synchronized');

    // Log success with OAuth install URL
    logger.info({
      port: env.PORT,
      oauthUrl: `http://localhost:${env.PORT}/slack/install`,
      healthLive: `http://localhost:${env.PORT}/health/live`,
      healthReady: `http://localhost:${env.PORT}/health/ready`,
    }, 'Slack Speak for Me is ready!');

  } catch (error) {
    logger.fatal({ err: error }, 'Failed to start application');
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(signal: string) {
  logger.info({ signal }, 'Received shutdown signal');

  try {
    // Stop workers first (let in-flight jobs complete)
    await stopWorkers();
    logger.info('Workers stopped');

    // Stop the Bolt app
    await app.stop();
    logger.info('App stopped');

    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, 'Error during shutdown');
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors - log and exit cleanly
process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception - exiting');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled rejection - exiting');
  process.exit(1);
});

// Start the application
main();
