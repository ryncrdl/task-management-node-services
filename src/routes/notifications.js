'use strict';

const express = require('express');
const config  = require('../config');
const { notificationLimiter } = require('../middleware/rateLimiter');
const laravelApi = require('../services/laravelApiClient');
const logger  = require('../utils/logger');

const router = express.Router();

/**
 * Internal auth — Laravel calls this endpoint with X-Service-Secret,
 * not a user JWT, so we use the same secret-based guard as /api/broadcast.
 */
function internalAuth(req, res, next) {
  const secret = config.internalServiceSecret;
  if (!secret || req.headers['x-service-secret'] !== secret) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }
  return next();
}

/**
 * POST /api/notifications/send
 * Internal endpoint called by Laravel when a task is assigned or status changes.
 * Returns immediately — processing is async (fire & forget).
 */
router.post('/send', notificationLimiter, internalAuth, async (req, res) => {
  const { task_id, user_id, event_type, details } = req.body;

  // Validate required fields
  if (!event_type) {
    return res.status(422).json({
      message: 'Validation failed.',
      errors: {
        event_type: ['event_type is required.'],
      },
    });
  }

  const validEventTypes = ['assigned', 'status_changed', 'mentioned', 'deactivated', 'reactivated'];
  if (!validEventTypes.includes(event_type)) {
    return res.status(422).json({
      message: `event_type must be one of: ${validEventTypes.join(', ')}.`,
    });
  }

  // Queue the notification via Laravel API
  try {
    const job = await laravelApi.createJob({ task_id, user_id, event_type, details: details || {} });
    logger.info('Notification job persisted', { job_id: job.id, event_type });
  } catch (err) {
    logger.error('Failed to persist notification job', { error: err.message });
    return res.status(502).json({ message: 'Failed to queue notification.' });
  }

  // Return immediately — cron will pick it up within 1 minute
  return res.status(202).json({
    message: 'Notification queued successfully.',
    queued: true,
  });
});

module.exports = router;
