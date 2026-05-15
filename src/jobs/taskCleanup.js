'use strict';

const laravelApi = require('../services/laravelApiClient');
const logger = require('../utils/logger');

/**
 * Task Cleanup Job — runs daily at midnight.
 *
 * Finds cancelled tasks older than 30 days and archives (force-deletes) them
 * via the Laravel API endpoint DELETE /api/tasks/{id}/archive.
 */
async function run() {
  logger.info('[TaskCleanup] Starting job...');

  const adminToken = getAdminToken();
  if (!adminToken) {
    logger.warn('[TaskCleanup] No admin token — skipping');
    return;
  }

  // Fetch all teams to get their task lists
  let teams;
  try {
    teams = await laravelApi.getTeams(adminToken);
  } catch (err) {
    logger.error('[TaskCleanup] Failed to fetch teams', { error: err.message });
    return;
  }

  let archivedCount = 0;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  for (const team of teams) {
    let response;
    try {
      response = await laravelApi.getTeamTasks(
        team.id,
        { per_page: 500, status: 'cancelled' },
        adminToken
      );
    } catch (err) {
      logger.error('[TaskCleanup] Failed to fetch tasks for team', {
        team_id: team.id,
        error: err.message,
      });
      continue;
    }

    const tasks = response.data || [];

    for (const task of tasks) {
      const updatedAt = new Date(task.updated_at);

      if (updatedAt < thirtyDaysAgo) {
        try {
          await laravelApi.archiveTask(task.id, adminToken);
          archivedCount++;
          logger.info('[TaskCleanup] Task archived', { task_id: task.id, title: task.title });
        } catch (err) {
          logger.error('[TaskCleanup] Failed to archive task', {
            task_id: task.id,
            error: err.message,
          });
        }
      }
    }
  }

  logger.info('[TaskCleanup] Completed', { archived: archivedCount });
}

/**
 * Returns the internal service token from environment config.
 * This token is a long-lived JWT generated for the service account.
 * It should NEVER be hardcoded — always read from INTERNAL_SERVICE_TOKEN env var.
 */
function getAdminToken() {
  const config = require('../config');
  if (!config.internalServiceToken) {
    throw new Error('[taskCleanup] INTERNAL_SERVICE_TOKEN is not configured');
  }
  return config.internalServiceToken;
}

module.exports = { run };
