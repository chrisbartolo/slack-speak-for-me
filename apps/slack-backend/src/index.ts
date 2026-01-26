import pino from 'pino';
import { startWorkers, stopWorkers } from './jobs/index.js';

const logger = pino({ name: 'app' });

async function main() {
  logger.info('Slack backend starting...');

  // TODO: Phase 01 Plan 02 will initialize @slack/bolt app here

  // Start background job workers
  await startWorkers();

  logger.info('Slack backend ready');
}

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down...');
  await stopWorkers();
  // TODO: Phase 01 Plan 02 will add app.stop() here
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

main().catch((err) => {
  logger.error({ err }, 'Failed to start application');
  process.exit(1);
});
