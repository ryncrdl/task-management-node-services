'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * JWT authentication middleware.
 * Validates the Bearer token from the Authorization header using the shared
 * JWT secret (same as Laravel's JWT_SECRET).
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization token required.' });
  }

  const token = authHeader.slice(7);

  if (!config.jwtSecret) {
    logger.error('JWT_SECRET is not configured');
    return res.status(500).json({ message: 'Server configuration error.' });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    req.user = {
      id: decoded.sub,
      role: decoded.role,
      name: decoded.name,
      email: decoded.email,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token has expired.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token.' });
    }
    logger.error('JWT verification error', { error: err.message });
    return res.status(401).json({ message: 'Authentication failed.' });
  }
}

/**
 * Role-based authorization middleware factory.
 * Usage: requireRole('admin', 'manager')
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthenticated.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Forbidden. Required role(s): ${roles.join(', ')}.`,
      });
    }

    next();
  };
}

module.exports = { authenticate, requireRole };
