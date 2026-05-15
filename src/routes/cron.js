'use strict';

const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { startScheduler, stopScheduler, getCronStatus } = require('../jobs/scheduler');
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
    res.status(500).json({ message: 'Failed to restart scheduler.' });
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
 * GET /api/cron/status
 * Get current status of all cron jobs.
 */
router.get('/status', adminOnly, (req, res) => {
  res.json({ jobs: getCronStatus() });
});

module.exports = router;
