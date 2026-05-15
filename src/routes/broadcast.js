'use strict';

const express = require('express');
const config  = require('../config');
const logger  = require('../utils/logger');

const router = express.Router();

function internalAuth(req, res, next) {
  const secret = config.internalServiceSecret;
  if (!secret || req.headers['x-service-secret'] !== secret) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }
  return next();
}

/**
 * POST /api/broadcast
 *
 * Called by the Laravel API to push real-time task events to WebSocket clients.
 * Payload: { event, room, data }
 *   event  — e.g. "task:updated", "task:created", "task:deleted", "comment:added"
 *   room   — e.g. "task:42" | "team:7" | "global"
 *   data   — arbitrary JSON payload forwarded to clients
 */
router.post('/', internalAuth, (req, res) => {
  const { event, room, rooms, data } = req.body;

  // Accept either a single `room` string or a `rooms` array
  const targets = rooms && Array.isArray(rooms) ? rooms : room ? [room] : [];

  if (!event || targets.length === 0) {
    return res.status(400).json({ message: '"event" and "room" (or "rooms") are required.' });
  }

  const io = req.app.get('io');

  if (!io) {
    logger.warn('Socket.io not available on app instance');
    return res.status(503).json({ message: 'WebSocket server unavailable.' });
  }

  targets.forEach((t) => {
    if (t === 'global') {
      io.emit(event, data);
    } else {
      io.to(t).emit(event, data);
    }
    logger.info('WebSocket broadcast', { event, room: t });
  });

  return res.json({ message: 'Broadcast sent.' });
});

module.exports = router;
