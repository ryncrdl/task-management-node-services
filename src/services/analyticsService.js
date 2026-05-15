'use strict';

const laravelApi = require('./laravelApiClient');
const cacheService = require('./cacheService');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Get task summary for a team.
 * Calculates total, completed, pending counts and average completion time.
 */
async function getTaskSummary(teamId, dateFrom, dateTo, token) {
  const cacheKey = `task-summary:${teamId}:${dateFrom || ''}:${dateTo || ''}`;

  return cacheService.remember(cacheKey, config.analyticsCacheTtl, async () => {
    const filters = { per_page: 500 }; // Fetch enough records for analytics

    if (dateFrom) filters.date_from = dateFrom;
    if (dateTo) filters.date_to = dateTo;

    const response = await laravelApi.getTeamTasks(teamId, filters, token);
    const tasks = response.data || [];

    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const pending = tasks.filter((t) => t.status === 'pending').length;
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
    const cancelled = tasks.filter((t) => t.status === 'cancelled').length;

    // Calculate average completion time in hours for completed tasks
    const completedTasks = tasks.filter(
      (t) => t.status === 'completed' && t.created_at && t.updated_at
    );

    let avgCompletionTime = null;
    if (completedTasks.length > 0) {
      const totalMs = completedTasks.reduce((sum, t) => {
        const created = new Date(t.created_at).getTime();
        const updated = new Date(t.updated_at).getTime();
        return sum + (updated - created);
      }, 0);
      avgCompletionTime = Math.round(totalMs / completedTasks.length / (1000 * 60 * 60)); // hours
    }

    logger.debug('Task summary calculated', { teamId, total, completed });

    return {
      team_id: teamId,
      date_from: dateFrom || null,
      date_to: dateTo || null,
      total_tasks: total,
      completed_tasks: completed,
      pending_tasks: pending,
      in_progress_tasks: inProgress,
      cancelled_tasks: cancelled,
      completion_rate: total > 0 ? Math.round((completed / total) * 100) : 0,
      avg_completion_time: avgCompletionTime,
      avg_completion_time_unit: 'hours',
    };
  });
}

/**
 * Get per-user productivity metrics for a team.
 */
async function getTeamProductivity(teamId, token) {
  const cacheKey = `team-productivity:${teamId}`;

  return cacheService.remember(cacheKey, config.analyticsCacheTtl, async () => {
    const response = await laravelApi.getTeamTasks(teamId, { per_page: 500 }, token);
    const tasks = response.data || [];

    // Group tasks by user
    const byUser = {};

    for (const task of tasks) {
      const userId = task.assigned_to?.id;
      const userName = task.assigned_to?.name;
      const userEmail = task.assigned_to?.email;

      if (!userId) continue;

      if (!byUser[userId]) {
        byUser[userId] = {
          user_id: userId,
          user_name: userName,
          user_email: userEmail,
          total_tasks: 0,
          completed_tasks: 0,
          pending_tasks: 0,
          in_progress_tasks: 0,
          completion_rate: 0,
          avg_completion_time: null,
          completion_times: [],
        };
      }

      byUser[userId].total_tasks++;

      if (task.status === 'completed') {
        byUser[userId].completed_tasks++;
        if (task.created_at && task.updated_at) {
          const hours =
            (new Date(task.updated_at) - new Date(task.created_at)) / (1000 * 60 * 60);
          byUser[userId].completion_times.push(hours);
        }
      } else if (task.status === 'pending') {
        byUser[userId].pending_tasks++;
      } else if (task.status === 'in_progress') {
        byUser[userId].in_progress_tasks++;
      }
    }

    // Calculate final stats
    const result = Object.values(byUser).map((u) => {
      const total = u.total_tasks;
      const completed = u.completed_tasks;

      const avgTime =
        u.completion_times.length > 0
          ? Math.round(
              u.completion_times.reduce((a, b) => a + b, 0) / u.completion_times.length
            )
          : null;

      return {
        user_id: u.user_id,
        user_name: u.user_name,
        user_email: u.user_email,
        total_tasks: total,
        completed_tasks: completed,
        pending_tasks: u.pending_tasks,
        in_progress_tasks: u.in_progress_tasks,
        completion_rate: total > 0 ? Math.round((completed / total) * 100) : 0,
        avg_completion_time_hours: avgTime,
      };
    });

    logger.debug('Team productivity calculated', { teamId, users: result.length });

    return result;
  });
}

/**
 * Get tasks due in the next 7 days, grouped by team member.
 */
async function getUpcomingDeadlines(teamId, token) {
  const cacheKey = `upcoming-deadlines:${teamId}`;

  return cacheService.remember(cacheKey, 300, async () => {
    // Short 5-min cache for deadline data
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const response = await laravelApi.getTeamTasks(
      teamId,
      { per_page: 500, status: 'pending' },
      token
    );
    const tasks = (response.data || []).filter((t) => {
      if (!t.due_date) return false;
      const due = new Date(t.due_date);
      return due >= now && due <= in7Days;
    });

    // Group by user
    const byUser = {};
    for (const task of tasks) {
      const userId = task.assigned_to?.id;
      if (!userId) continue;

      if (!byUser[userId]) {
        byUser[userId] = {
          user_id: userId,
          user_name: task.assigned_to?.name,
          tasks: [],
        };
      }
      byUser[userId].tasks.push({
        id: task.id,
        title: task.title,
        priority: task.priority,
        due_date: task.due_date,
        status: task.status,
      });
    }

    return Object.values(byUser);
  });
}

module.exports = { getTaskSummary, getTeamProductivity, getUpcomingDeadlines };
