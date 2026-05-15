'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth');
const exportService = require('../services/exportService');
const logger = require('../utils/logger');

const router = express.Router();

// Export requires authentication (all roles allowed — data is scoped to the team)
router.use(authenticate);

/**
 * POST /api/export/tasks
 * Exports tasks for a team in the requested format (csv, json, xlsx).
 *
 * Body: { team_id, format, filters: { status, date_from, date_to, ... } }
 */
router.post('/tasks', async (req, res) => {
  const { team_id, format, filters = {} } = req.body;

  // Whitelist allowed filter keys to prevent parameter injection
  const ALLOWED_FILTER_KEYS = ['status', 'priority', 'assigned_to', 'date_from', 'date_to'];
  const safeFilters = Object.fromEntries(
    Object.entries(filters).filter(([k]) => ALLOWED_FILTER_KEYS.includes(k))
  );

  // Validate required fields
  if (!team_id) {
    return res.status(422).json({ message: 'team_id is required.' });
  }

  const validFormats = ['csv', 'json', 'xlsx'];
  const exportFormat = (format || 'json').toLowerCase();

  if (!validFormats.includes(exportFormat)) {
    return res.status(422).json({
      message: `format must be one of: ${validFormats.join(', ')}.`,
    });
  }

  const token = req.headers.authorization?.slice(7);

  logger.info('Export requested', {
    team_id,
    format: exportFormat,
    requested_by: req.user?.id,
    filters,
  });

  try {
    const tasks = await exportService.fetchTasksForExport(
      parseInt(team_id, 10),
      safeFilters,
      token
    );

    if (tasks.length === 0) {
      return res.status(404).json({ message: 'No tasks found matching the given filters.' });
    }

    switch (exportFormat) {
      case 'csv':
        return exportService.exportCsv(tasks, res);
      case 'xlsx':
        return exportService.exportXlsx(tasks, res);
      case 'json':
      default:
        return exportService.exportJson(tasks, res);
    }
  } catch (err) {
    logger.error('Export failed', { team_id, format: exportFormat, error: err.message });
    return res.status(500).json({ message: 'Export failed. Please try again.' });
  }
});

module.exports = router;
