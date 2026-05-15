'use strict';

const laravelApi = require('../services/laravelApiClient');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

/**
 * Deadline Reminder Job — runs every 2 hours.
 *
 * Fetches tasks due within the next 24 hours and sends reminder emails
 * to the assigned users.
 */
async function run() {
  logger.info('[DeadlineReminder] Starting job...');

  const adminToken = getAdminToken();

  let upcomingTasks;
  try {
    upcomingTasks = await laravelApi.getUpcomingDeadlines(adminToken);
  } catch (err) {
    logger.error('[DeadlineReminder] Failed to fetch upcoming deadlines', { error: err.message });
    return;
  }

  if (!upcomingTasks || upcomingTasks.length === 0) {
    logger.info('[DeadlineReminder] No upcoming deadlines found');
    return;
  }

  // Group by assignee email
  const byUser = {};

  for (const task of upcomingTasks) {
    const userEmail = task.assigned_to?.email;
    const userName = task.assigned_to?.name;

    if (!userEmail) continue;

    if (!byUser[userEmail]) {
      byUser[userEmail] = { userName, tasks: [] };
    }

    byUser[userEmail].tasks.push({
      id: task.id,
      title: task.title,
      priority: task.priority,
      due_date: task.due_date,
    });
  }

  await notificationService.sendDeadlineReminders(byUser);

  logger.info('[DeadlineReminder] Completed', {
    tasks_found: upcomingTasks.length,
    users_notified: Object.keys(byUser).length,
  });
}

/**
 * Returns the internal service token from environment config.
 * This token is a long-lived JWT generated for the service account.
 * It should NEVER be hardcoded — always read from INTERNAL_SERVICE_TOKEN env var.
 */
function getAdminToken() {
  const config = require('../config');
  if (!config.internalServiceToken) {
    throw new Error('[deadlineReminder] INTERNAL_SERVICE_TOKEN is not configured');
  }
  return config.internalServiceToken;
}

module.exports = { run };
