'use strict';

const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { startScheduler, stopScheduler, pauseJob, resumeJob, getCronStatus } = require('../jobs/scheduler');
const logger = require('../utils/logger');

const router = express.Router();
const adminOnly = [authenticate, requireRole('admin')];

/**
 * POST /api/cron/restart
 * Stop all cron jobs and restart them.
 */
router.post('/restart', adminOnly, (req, res) => {
  try {
    stopScheduler();
    startScheduler();
    logger.info('Cron scheduler restarted by admin', { user: req.user.id });
    res.json({ message: 'Cron scheduler restarted.', jobs: getCronStatus() });
  } catch (err) {
    logger.error('Failed to restart cron scheduler', { error: err.message });
    res.status(500).json({ message: `Failed to restart scheduler: ${err.message}` });
  }
});

/**
 * POST /api/cron/trigger/notification-processor
 * Manually run the notification processor immediately.
 */
router.post('/trigger/notification-processor', adminOnly, async (req, res) => {
  try {
    const { processPendingJobs } = require('../services/notificationService');
    logger.info('Notification processor manually triggered by admin', { user: req.user.id });
    await processPendingJobs();
    res.json({ message: 'Notification processor triggered successfully.' });
  } catch (err) {
    logger.error('Manual trigger failed', { error: err.message });
    res.status(500).json({ message: `Trigger failed: ${err.message}` });
  }
});

/**
 * POST /api/cron/trigger/deadline-reminder
 */
router.post('/trigger/deadline-reminder', adminOnly, async (req, res) => {
  try {
    const { run } = require('../jobs/deadlineReminder');
    logger.info('DeadlineReminder manually triggered by admin', { user: req.user.id });
    await run();
    res.json({ message: 'Deadline reminder job triggered successfully.' });
  } catch (err) {
    logger.error('DeadlineReminder manual trigger failed', { error: err.message });
    res.status(500).json({ message: `Trigger failed: ${err.message}` });
  }
});

/**
 * POST /api/cron/trigger/daily-digest
 */
router.post('/trigger/daily-digest', adminOnly, async (req, res) => {
  try {
    const { run } = require('../jobs/dailyDigest');
    logger.info('DailyDigest manually triggered by admin', { user: req.user.id });
    await run();
    res.json({ message: 'Daily digest job triggered successfully.' });
  } catch (err) {
    logger.error('DailyDigest manual trigger failed', { error: err.message });
    res.status(500).json({ message: `Trigger failed: ${err.message}` });
  }
});

/**
 * POST /api/cron/trigger/task-cleanup
 */
router.post('/trigger/task-cleanup', adminOnly, async (req, res) => {
  try {
    const { run } = require('../jobs/taskCleanup');
    logger.info('TaskCleanup manually triggered by admin', { user: req.user.id });
    await run();
    res.json({ message: 'Task cleanup job triggered successfully.' });
  } catch (err) {
    logger.error('TaskCleanup manual trigger failed', { error: err.message });
    res.status(500).json({ message: `Trigger failed: ${err.message}` });
  }
});

/**
 * POST /api/cron/pause/:jobName
 * Pause a single cron job.
 */
router.post('/pause/:jobName', adminOnly, (req, res) => {
  try {
    pauseJob(req.params.jobName);
    logger.info('Cron job paused by admin', { user: req.user.id, job: req.params.jobName });
    res.json({ message: `Job "${req.params.jobName}" paused.`, jobs: getCronStatus() });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/**
 * POST /api/cron/resume/:jobName
 * Resume a paused cron job.
 */
router.post('/resume/:jobName', adminOnly, (req, res) => {
  try {
    resumeJob(req.params.jobName);
    logger.info('Cron job resumed by admin', { user: req.user.id, job: req.params.jobName });
    res.json({ message: `Job "${req.params.jobName}" resumed.`, jobs: getCronStatus() });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/**
 * GET /api/cron/status
 * Get current status of all cron jobs.
 */
router.get('/status', adminOnly, (req, res) => {
  res.json({ jobs: getCronStatus() });
});

module.exports = router;
