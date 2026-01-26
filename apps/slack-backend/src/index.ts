import pino from 'pino';
import { app } from './app.js';
import { env } from './env.js';
import { startWorkers, stopWorkers } from './jobs/index.js';

const logger = pino({ name: 'app' });

async function main() {
  logger.info('Slack backend starting...');

  // Start Slack Bolt app
  await app.start(env.PORT);
  logger.info(`Bolt app is running on port ${env.PORT}`);

  // Start background job workers
  await startWorkers();

  logger.info('Slack backend ready');
}

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down...');
  await app.stop();
  await stopWorkers();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

main().catch((err) => {
  logger.error({ err }, 'Failed to start application');
  process.exit(1);
});
