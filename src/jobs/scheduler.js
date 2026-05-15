'use strict';

const cron = require('node-cron');
const dailyDigestJob = require('./dailyDigest');
const deadlineReminderJob = require('./deadlineReminder');
const taskCleanupJob = require('./taskCleanup');
const logger = require('../utils/logger');

// Mutable arrays — cleared and repopulated on each startScheduler() call
let scheduledJobs = [];
let JOB_REGISTRY  = [];

function startScheduler() {
  // Clear previous registrations so restart doesn't duplicate
  scheduledJobs = [];
  JOB_REGISTRY  = [];

  logger.info('Starting cron scheduler...');

  // ── Job 1: Notification Queue Processor — every 30 seconds ───────────────
  const notifProcessor = cron.schedule('*/30 * * * * *', async () => {
    logger.debug('[CRON] Processing pending notification jobs');
    try {
      const { processPendingJobs } = require('../services/notificationService');
      await processPendingJobs();
    } catch (err) {
      logger.error('[CRON] Notification processor failed', { error: err.message });
    }
  }, { scheduled: true });
  JOB_REGISTRY.push({ name: 'notification-processor', schedule: '*/30 * * * * *', description: 'Process pending email notification jobs' });

  // ── Job 2: Daily Digest — every morning at 8 AM ───────────────────────────
  const digest = cron.schedule('0 8 * * *', async () => {
    logger.info('[CRON] Running daily digest job');
    try {
      await dailyDigestJob.run();
    } catch (err) {
      logger.error('[CRON] Daily digest failed', { error: err.message });
    }
  });
  JOB_REGISTRY.push({ name: 'daily-digest', schedule: '0 8 * * *', description: 'Send daily task digest emails at 08:00 UTC' });

  // ── Job 3: Deadline Reminder — every 2 hours ──────────────────────────────
  const reminder = cron.schedule('0 */2 * * *', async () => {
    logger.info('[CRON] Running deadline reminder job');
    try {
      await deadlineReminderJob.run();
    } catch (err) {
      logger.error('[CRON] Deadline reminder failed', { error: err.message });
    }
  });
  JOB_REGISTRY.push({ name: 'deadline-reminder', schedule: '0 */2 * * *', description: 'Send deadline reminder emails every 2 hours' });

  // ── Job 4: Task Cleanup — every day at midnight ───────────────────────────
  const cleanup = cron.schedule('0 0 * * *', async () => {
    logger.info('[CRON] Running task cleanup job');
    try {
      await taskCleanupJob.run();
    } catch (err) {
      logger.error('[CRON] Task cleanup failed', { error: err.message });
    }
  });
  JOB_REGISTRY.push({ name: 'task-cleanup', schedule: '0 0 * * *', description: 'Archive or clean up old completed tasks at midnight' });

  scheduledJobs.push(notifProcessor, digest, reminder, cleanup);

  logger.info('Cron jobs scheduled', {
    jobs: JOB_REGISTRY.map((j) => `${j.name} (${j.schedule})`),
  });
}

function stopScheduler() {
  scheduledJobs.forEach((job) => job.stop());
  scheduledJobs = [];
  logger.info('All cron jobs stopped.');
}

function getCronStatus() {
  return JOB_REGISTRY.map((j) => ({
    name:        j.name,
    schedule:    j.schedule,
    description: j.description,
    running:     scheduledJobs.length > 0,
  }));
}

module.exports = { startScheduler, stopScheduler, getCronStatus };
