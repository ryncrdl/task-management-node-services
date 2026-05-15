'use strict';

const morgan = require('morgan');
const logger = require('../utils/logger');

/**
 * HTTP request/response logger using Morgan + Winston.
 */
const requestLogger = morgan(
  ':method :url :status :res[content-length] - :response-time ms',
  {
    stream: {
      write: (message) => logger.http(message.trim()),
    },
  }
);

module.exports = { requestLogger };
