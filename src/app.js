'use strict';

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { requestLogger } = require('./middleware/logger');
const { apiLimiter } = require('./middleware/rateLimiter');
const notificationsRouter = require('./routes/notifications');
const analyticsRouter = require('./routes/analytics');
const exportRouter = require('./routes/export');
const broadcastRouter = require('./routes/broadcast');
const logger = require('./utils/logger');

const app = express();

// Trust the first proxy (required on Render/Heroku/etc.) so that
// express-rate-limit can read the real client IP from X-Forwarded-For
app.set('trust proxy', 1);

// ─── Security middleware ──────────────────────────────────────────────────────
app.use(helmet());

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Request logging ──────────────────────────────────────────────────────────
app.use(requestLogger);

// ─── Rate limiting ────────────────────────────────────────────────────────────
app.use('/api/', apiLimiter);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'node-services',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/notifications', notificationsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/export', exportRouter);
app.use('/api/broadcast', broadcastRouter);

// ─── Email preview (dev only) ─────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  const { emailTemplates } = require('./utils/emailTemplates');
  const SAMPLE_TASKS = [
    { title: 'Set up CI/CD pipeline', status: 'in_progress', priority: 'high',   due_date: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString() },
    { title: 'Write unit tests',      status: 'pending',     priority: 'medium', due_date: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString() },
    { title: 'Update README',         status: 'pending',     priority: 'low',    due_date: null },
  ];
  const removeCsp = (_req, res, next) => { res.removeHeader('Content-Security-Policy'); next(); };
  app.get('/email-preview/:type', removeCsp, (req, res) => {
    const type = req.params.type;
    const frontendUrl = require('./config').frontendUrl;
    let tpl;
    if (type === 'assigned') {
      tpl = emailTemplates.taskAssigned({ userName: 'Ryan Cordial', taskTitle: 'Set up CI/CD pipeline', taskDescription: 'Configure GitHub Actions for automated testing and deployment.', teamName: 'Engineering', priority: 'high', dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), taskUrl: `${frontendUrl}/tasks/5` });
    } else if (type === 'status') {
      tpl = emailTemplates.statusChanged({ userName: 'Ryan Cordial', taskTitle: 'Set up CI/CD pipeline', oldStatus: 'pending', newStatus: 'in_progress', teamName: 'Engineering', taskUrl: `${frontendUrl}/tasks/5` });
    } else if (type === 'deadline') {
      tpl = emailTemplates.deadlineReminder({ userName: 'Ryan Cordial', tasks: SAMPLE_TASKS.slice(0, 2) });
    } else if (type === 'digest') {
      tpl = emailTemplates.dailyDigest({ userName: 'Ryan Cordial', tasks: SAMPLE_TASKS });
    } else if (type === 'digest-empty') {
      tpl = emailTemplates.dailyDigest({ userName: 'Ryan Cordial', tasks: [] });
    } else if (type === 'mentioned') {
      tpl = emailTemplates.mentioned({ userName: 'Ryan Cordial', taskTitle: 'Set up CI/CD pipeline', teamName: 'Engineering', commentBody: 'Hey @Ryan Cordial can you take a look at this before we deploy?', mentionedBy: 'Admin User', taskUrl: `${frontendUrl}/tasks/5` });
    } else if (type === 'deactivated') {
      tpl = emailTemplates.deactivated({ userName: 'Ryan Cordial', deactivatedBy: 'Admin User' });
    } else {
      return res.status(404).send('Unknown type. Try: assigned | status | deadline | digest | digest-empty');
    }
    res.setHeader('Content-Type', 'text/html');
    res.send(tpl.html);
  });
  logger.info('Email preview available at /email-preview/:type  (assigned|status|deadline|digest)');
}

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

// ─── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({
    message: process.env.NODE_ENV === 'production' ? 'Internal server error.' : err.message,
  });
});

module.exports = app;
