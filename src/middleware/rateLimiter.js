'use strict';

const rateLimit = require('express-rate-limit');
const config = require('../config');

/**
 * General API rate limiter — applied globally.
 */
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' },
});

/**
 * Stricter limiter for notification endpoint to prevent spam.
 */
const notificationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Notification rate limit exceeded. Slow down.' },
  keyGenerator: (req) => req.body?.user_id?.toString() || req.ip,
});

module.exports = { apiLimiter, notificationLimiter };
