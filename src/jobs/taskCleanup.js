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

  // Fetch all teams to get their task lists
  let teams;
  try {
    teams = await laravelApi.getTeams();
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
        { per_page: 500, status: 'cancelled' }
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
          await laravelApi.archiveTask(task.id);
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

module.exports = { run };
