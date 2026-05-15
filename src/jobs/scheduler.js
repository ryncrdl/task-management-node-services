'use strict';

const cron = require('node-cron');
const dailyDigestJob = require('./dailyDigest');
const deadlineReminderJob = require('./deadlineReminder');
const taskCleanupJob = require('./taskCleanup');
const logger = require('../utils/logger');

const scheduledJobs = [];

function startScheduler() {
  logger.info('Starting cron scheduler...');

  // ── Job 1: Daily Digest — every morning at 8 AM ───────────────────────────
  const digest = cron.schedule('0 8 * * *', async () => {
    logger.info('[CRON] Running daily digest job');
    try {
      await dailyDigestJob.run();
    } catch (err) {
      logger.error('[CRON] Daily digest failed', { error: err.message });
    }
  });

  // ── Job 2: Deadline Reminder — every 2 hours ──────────────────────────────
  const reminder = cron.schedule('0 */2 * * *', async () => {
    logger.info('[CRON] Running deadline reminder job');
    try {
      await deadlineReminderJob.run();
    } catch (err) {
      logger.error('[CRON] Deadline reminder failed', { error: err.message });
    }
  });

  // ── Job 3: Task Cleanup — every day at midnight ───────────────────────────
  const cleanup = cron.schedule('0 0 * * *', async () => {
    logger.info('[CRON] Running task cleanup job');
    try {
      await taskCleanupJob.run();
    } catch (err) {
      logger.error('[CRON] Task cleanup failed', { error: err.message });
    }
  });

  scheduledJobs.push(digest, reminder, cleanup);

  logger.info('Cron jobs scheduled', {
    jobs: ['daily-digest (08:00)', 'deadline-reminder (every 2h)', 'task-cleanup (00:00)'],
  });
}

function stopScheduler() {
  scheduledJobs.forEach((job) => job.stop());
  logger.info('All cron jobs stopped.');
}

module.exports = { startScheduler, stopScheduler };
