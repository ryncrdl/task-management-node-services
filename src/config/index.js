'use strict';

require('dotenv').config();

/**
 * Validate required environment variables at startup.
 * Throws immediately if a critical variable is missing so the process fails fast
 * rather than silently operating in a degraded/insecure state.
 */
function required(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`[Config] Missing required environment variable: ${key}`);
  }
  return value;
}

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  laravelApiUrl: required('LARAVEL_API_URL'),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  jwtSecret: required('JWT_SECRET'),
  /**
   * Long-lived JWT token for internal service-to-service calls (cron jobs).
   * Generate via: php artisan tinker
   *   echo JWTAuth::fromUser(User::where('role','admin')->first());
   * Store in .env as INTERNAL_SERVICE_TOKEN — never commit to source control.
   */
  internalServiceToken: required('INTERNAL_SERVICE_TOKEN'),
  internalServiceSecret: process.env.INTERNAL_SERVICE_SECRET,

  mail: {
    host: process.env.MAIL_HOST || 'localhost',
    port: parseInt(process.env.MAIL_PORT, 10) || 1025,
    user: process.env.MAIL_USER || '',
    pass: (process.env.MAIL_PASS || '').replace(/\s+/g, ''),
    from:     process.env.MAIL_FROM     || process.env.MAIL_USER || 'noreply@taskmanagement.com',
    fromName: process.env.MAIL_FROM_NAME || 'Task Management',
    // Resend fallback (used when SMTP connection times out)
    resendApiKey: process.env.RESEND_API_KEY || null,
    resendFrom:   process.env.RESEND_FROM    || 'onboarding@resend.dev',
  },

  redisUrl: process.env.REDIS_URL || null,

  db: {
    host:     process.env.DB_HOST     || '127.0.0.1',
    port:     parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_DATABASE || 'task_management',
    user:     process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  },

  analyticsCacheTtl: parseInt(process.env.ANALYTICS_CACHE_TTL, 10) || 3600,

  logLevel: process.env.LOG_LEVEL || 'info',
};
