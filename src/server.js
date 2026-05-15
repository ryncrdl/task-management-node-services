'use strict';

const app = require('./app');
const { startScheduler, stopScheduler } = require('./jobs/scheduler');
const config = require('./config');
const logger = require('./utils/logger');

const PORT = config.port;

const server = app.listen(PORT, () => {
  logger.info(`Node.js service started`, {
    port: PORT,
    env: config.nodeEnv,
    laravelApi: config.laravelApiUrl,
  });

  // Start background cron jobs
  startScheduler();
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────

function shutdown(signal) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);

  stopScheduler();

  server.close((err) => {
    if (err) {
      logger.error('Error during server shutdown', { error: err.message });
      process.exit(1);
    }
    logger.info('Server closed. Exiting.');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
  process.exit(1);
});

module.exports = server;
