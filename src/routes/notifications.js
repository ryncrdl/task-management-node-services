'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth');
const { notificationLimiter } = require('../middleware/rateLimiter');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * POST /api/notifications/send
 * Internal endpoint called by Laravel when a task is assigned or status changes.
 * Returns immediately — processing is async (fire & forget).
 */
router.post('/send', notificationLimiter, authenticate, (req, res) => {
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

  // Extract the original token to pass to background job
  const token = req.headers.authorization?.slice(7);

  // Queue the notification asynchronously
  notificationService.queueNotification({
    task_id,
    user_id,
    event_type,
    details: details || {},
    token,
  });

  logger.info('Notification queued via API', { task_id, user_id, event_type });

  // Return immediately — processing continues in background
  return res.status(202).json({
    message: 'Notification queued successfully.',
    queued: true,
  });
});

module.exports = router;
