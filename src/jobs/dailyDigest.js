'use strict';

const laravelApi = require('../services/laravelApiClient');
const notificationService = require('../services/notificationService');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Daily Digest Job — runs every morning at 8 AM.
 *
 * Fetches all incomplete tasks grouped by user from Laravel API,
 * then sends a daily summary email to each user.
 */
async function run() {
  logger.info('[DailyDigest] Starting job...');

  // Obtain an admin token for internal API calls
  // In production this would use a long-lived service account token or OAuth client credentials.
  // For this implementation we use the INTERNAL_SERVICE_SECRET header.
  const adminToken = getAdminToken();
  if (!adminToken) {
    logger.warn('[DailyDigest] No admin token available — skipping');
    return;
  }

  let tasksByUser;
  try {
    tasksByUser = await laravelApi.getIncompleteTasksByUser(adminToken);
  } catch (err) {
    logger.error('[DailyDigest] Failed to fetch tasks from Laravel', { error: err.message });
    return;
  }

  if (!tasksByUser || Object.keys(tasksByUser).length === 0) {
    logger.info('[DailyDigest] No incomplete tasks found');
    return;
  }

  // Build user-keyed digest data
  const digestMap = {};

  for (const [userId, tasks] of Object.entries(tasksByUser)) {
    const tasksArray = Array.isArray(tasks) ? tasks : [tasks];

    if (tasksArray.length === 0) continue;

    const firstTask = tasksArray[0];
    const userEmail = firstTask?.assigned_to?.email;
    const userName = firstTask?.assigned_to?.name || `User #${userId}`;

    if (!userEmail) continue;

    digestMap[userEmail] = {
      userName,
      tasks: tasksArray.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        due_date: t.due_date,
      })),
    };
  }

  await notificationService.sendDailyDigests(digestMap);

  logger.info('[DailyDigest] Completed', { users_notified: Object.keys(digestMap).length });
}

/**
 * Get an admin JWT token for internal API calls.
 * In production, use a dedicated service account with a long-lived token.
 */
/**
 * Returns the internal service token from environment config.
 * This token is a long-lived JWT generated for the service account.
 * It should NEVER be hardcoded — always read from INTERNAL_SERVICE_TOKEN env var.
 */
function getAdminToken() {
  const config = require('../config');
  if (!config.internalServiceToken) {
    throw new Error('[dailyDigest] INTERNAL_SERVICE_TOKEN is not configured');
  }
  return config.internalServiceToken;
}

module.exports = { run };
