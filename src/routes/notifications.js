'use strict';

const express = require('express');
const config = require('../config');
const { notificationLimiter } = require('../middleware/rateLimiter');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

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
router.post('/send', notificationLimiter, internalAuth, (req, res) => {
  const { task_id, user_id, event_type, details } = req.body;

  // Validate required fields
  if (!task_id || !event_type) {
    return res.status(422).json({
      message: 'Validation failed.',
      errors: {
        task_id: !task_id ? ['task_id is required.'] : [],
        event_type: !event_type ? ['event_type is required.'] : [],
      },
    });
  }

  const validEventTypes = ['assigned', 'status_changed'];
  if (!validEventTypes.includes(event_type)) {
    return res.status(422).json({
      message: `event_type must be one of: ${validEventTypes.join(', ')}.`,
    });
  }

  // Queue the notification asynchronously
  notificationService.queueNotification({
    task_id,
    user_id,
    event_type,
    details: details || {},
  });

  logger.info('Notification queued via API', { task_id, user_id, event_type });

  // Return immediately — processing continues in background
  return res.status(202).json({
    message: 'Notification queued successfully.',
    queued: true,
  });
});

module.exports = router;
