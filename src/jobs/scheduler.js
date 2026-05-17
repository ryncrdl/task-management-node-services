'use strict';

const cron = require('node-cron');
const dailyDigestJob = require('./dailyDigest');
const deadlineReminderJob = require('./deadlineReminder');
const taskCleanupJob = require('./taskCleanup');
const logger = require('../utils/logger');

/**
 * jobsMap tracks each running ScheduledTask and its paused state.
 * Shape: { [name]: { task: ScheduledTask, paused: boolean } }
 */
let jobsMap = {};

const JOB_DEFS = [
  { name: 'notification-processor', schedule: '*/30 * * * * *', description: 'Process pending email notification jobs' },
  { name: 'daily-digest',           schedule: '0 8 * * *',      description: 'Send daily task digest emails at 08:00 UTC' },
  { name: 'deadline-reminder',      schedule: '0 */2 * * *',    description: 'Send deadline reminder emails every 2 hours' },
  { name: 'task-cleanup',           schedule: '0 0 * * *',      description: 'Archive old completed tasks at midnight' },
];

function startScheduler() {
  // Stop any existing tasks before recreating
  Object.values(jobsMap).forEach(({ task }) => task.stop());
  jobsMap = {};

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
  jobsMap['notification-processor'] = { task: notifProcessor, paused: false };

  // ── Job 2: Daily Digest — every morning at 8 AM ───────────────────────────
  const digest = cron.schedule('0 8 * * *', async () => {
    logger.info('[CRON] Running daily digest job');
    try { await dailyDigestJob.run(); }
    catch (err) { logger.error('[CRON] Daily digest failed', { error: err.message }); }
  });
  jobsMap['daily-digest'] = { task: digest, paused: false };

  // ── Job 3: Deadline Reminder — every 2 hours ──────────────────────────────
  const reminder = cron.schedule('0 */2 * * *', async () => {
    logger.info('[CRON] Running deadline reminder job');
    try { await deadlineReminderJob.run(); }
    catch (err) { logger.error('[CRON] Deadline reminder failed', { error: err.message }); }
  });
  jobsMap['deadline-reminder'] = { task: reminder, paused: false };

  // ── Job 4: Task Cleanup — every day at midnight ───────────────────────────
  const cleanup = cron.schedule('0 0 * * *', async () => {
    logger.info('[CRON] Running task cleanup job');
    try { await taskCleanupJob.run(); }
    catch (err) { logger.error('[CRON] Task cleanup failed', { error: err.message }); }
  });
  jobsMap['task-cleanup'] = { task: cleanup, paused: false };

  logger.info('Cron jobs scheduled', {
    jobs: JOB_DEFS.map((j) => `${j.name} (${j.schedule})`),
  });
}

function stopScheduler() {
  Object.values(jobsMap).forEach(({ task }) => task.stop());
  jobsMap = {};
  logger.info('All cron jobs stopped.');
}

/**
 * Pause a single job by name (keeps it registered, stops firing).
 */
function pauseJob(name) {
  const entry = jobsMap[name];
  if (!entry) throw new Error(`Job "${name}" not found`);
  if (entry.paused) throw new Error(`Job "${name}" is already paused`);
  entry.task.stop();
  entry.paused = true;
  logger.info(`Cron job paused: ${name}`);
}

/**
 * Resume a previously paused job.
 */
function resumeJob(name) {
  const entry = jobsMap[name];
  if (!entry) throw new Error(`Job "${name}" not found`);
  if (!entry.paused) throw new Error(`Job "${name}" is not paused`);
  entry.task.start();
  entry.paused = false;
  logger.info(`Cron job resumed: ${name}`);
}

function getCronStatus() {
  return JOB_DEFS.map((j) => {
    const entry = jobsMap[j.name];
    return {
      name:        j.name,
      schedule:    j.schedule,
      description: j.description,
      running:     !!entry && !entry.paused,
      paused:      !!entry && entry.paused,
    };
  });
}

module.exports = { startScheduler, stopScheduler, pauseJob, resumeJob, getCronStatus };
