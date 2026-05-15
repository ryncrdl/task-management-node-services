'use strict';

const http = require('http');
const { Server: SocketIOServer } = require('socket.io');
const app = require('./app');
const { startScheduler, stopScheduler } = require('./jobs/scheduler');
const config = require('./config');
const logger = require('./utils/logger');

const PORT = config.port;

// ─── HTTP + Socket.io server ──────────────────────────────────────────────────
const httpServer = http.createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  },
});

// Attach io to app so routes can access it
app.set('io', io);

io.on('connection', (socket) => {
  logger.info('WebSocket client connected', { id: socket.id });

  // Clients can join a room per task to receive targeted updates
  socket.on('join:task',  (taskId) => { socket.join(`task:${taskId}`); });
  socket.on('leave:task', (taskId) => { socket.leave(`task:${taskId}`); });

  // Team rooms — task list pages join these to get live CRUD events
  socket.on('join:team',  (teamId) => { socket.join(`team:${teamId}`); });
  socket.on('leave:team', (teamId) => { socket.leave(`team:${teamId}`); });

  // Personal user rooms for mention notifications
  socket.on('join:user',  (userId) => { socket.join(`user:${userId}`); });
  socket.on('leave:user', (userId) => { socket.leave(`user:${userId}`); });

  socket.on('disconnect', () => {
    logger.info('WebSocket client disconnected', { id: socket.id });
  });
});

httpServer.listen(PORT, () => {
  logger.info('Node.js service started', {
    port: PORT,
    env: config.nodeEnv,
    laravelApi: config.laravelApiUrl,
  });

  startScheduler();
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
function shutdown(signal) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  stopScheduler();
  httpServer.close((err) => {
    if (err) {
      logger.error('Error during server shutdown', { error: err.message });
      process.exit(1);
    }
    logger.info('Server closed.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
  process.exit(1);
});
