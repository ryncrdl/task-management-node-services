'use strict';

const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const analyticsService = require('../services/analyticsService');
const logger = require('../utils/logger');

const router = express.Router();

// All analytics routes require authentication and admin/manager role
router.use(authenticate, requireRole('admin', 'manager'));

/**
 * GET /api/analytics/task-summary?team_id=1&date_from=2024-01-01&date_to=2024-12-31
 * Returns aggregate task counts and average completion time for a team.
 */
router.get('/task-summary', async (req, res) => {
  const { team_id, date_from, date_to } = req.query;

  if (!team_id) {
    return res.status(422).json({ message: 'team_id query parameter is required.' });
  }

  const token = req.headers.authorization?.slice(7);

  try {
    const summary = await analyticsService.getTaskSummary(
      parseInt(team_id, 10),
      date_from,
      date_to,
      token
    );
    return res.json({ data: summary });
  } catch (err) {
    logger.error('Task summary error', { error: err.message, team_id });
    return res.status(500).json({ message: 'Failed to fetch task summary.' });
  }
});

/**
 * GET /api/analytics/team-productivity?team_id=1
 * Returns per-user task counts, completion rates, and average completion time.
 */
router.get('/team-productivity', async (req, res) => {
  const { team_id } = req.query;

  if (!team_id) {
    return res.status(422).json({ message: 'team_id query parameter is required.' });
  }

  const token = req.headers.authorization?.slice(7);

  try {
    const productivity = await analyticsService.getTeamProductivity(
      parseInt(team_id, 10),
      token
    );
    return res.json({ data: productivity });
  } catch (err) {
    logger.error('Team productivity error', { error: err.message, team_id });
    return res.status(500).json({ message: 'Failed to fetch team productivity.' });
  }
});

/**
 * GET /api/analytics/upcoming-deadlines?team_id=1
 * Returns tasks due in the next 7 days, grouped by team member.
 */
router.get('/upcoming-deadlines', async (req, res) => {
  const { team_id } = req.query;

  if (!team_id) {
    return res.status(422).json({ message: 'team_id query parameter is required.' });
  }

  const token = req.headers.authorization?.slice(7);

  try {
    const deadlines = await analyticsService.getUpcomingDeadlines(
      parseInt(team_id, 10),
      token
    );
    return res.json({ data: deadlines });
  } catch (err) {
    logger.error('Upcoming deadlines error', { error: err.message, team_id });
    return res.status(500).json({ message: 'Failed to fetch upcoming deadlines.' });
  }
});

module.exports = router;
