'use strict';

require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const yaml = require('js-yaml');
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

// ─── Swagger UI (API Docs) ────────────────────────────────────────────────────
try {
  const openapiPath = path.resolve(__dirname, '../../task-management-laravel-api/openapi.yaml');
  const swaggerDocument = yaml.load(fs.readFileSync(openapiPath, 'utf8'));

  // Pin the server to match the current environment — no dropdown confusion
  const isProd = process.env.NODE_ENV === 'production';
  swaggerDocument.servers = [
    isProd
      ? { url: 'https://task-management-laravel-api.onrender.com/api', description: 'Production' }
      : { url: 'http://localhost:8000/api', description: 'Local development' },
  ];

  // Strip the CSP header set by the global helmet() so Swagger UI can fetch
  // the API from a different origin (e.g. localhost:8000 from localhost:3000)
  const removeCsp = (_req, res, next) => { res.removeHeader('Content-Security-Policy'); next(); };

  app.use(
    '/api-docs',
    removeCsp,
    swaggerUi.serve,
    swaggerUi.setup(swaggerDocument, { explorer: false }),
  );
  logger.info('Swagger UI available at /api-docs');
} catch (err) {
  logger.warn('Could not load openapi.yaml for Swagger UI', { error: err.message });
}

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
