'use strict';

const { format: csvFormat } = require('@fast-csv/format');
const XLSX = require('xlsx');
const laravelApi = require('./laravelApiClient');
const logger = require('../utils/logger');

/**
 * Fetch tasks from Laravel API for export.
 */
async function fetchTasksForExport(teamId, filters, token) {
  const params = { per_page: 1000, ...filters };

  const response = await laravelApi.getTeamTasks(teamId, params, token);
  return response.data || [];
}

/**
 * Flatten a task object into a spreadsheet-friendly row.
 */
function flattenTask(task) {
  return {
    ID: task.id,
    Title: task.title,
    Description: task.description || '',
    Status: task.status,
    Priority: task.priority,
    'Assigned To': task.assigned_to?.name || '',
    'Assigned Email': task.assigned_to?.email || '',
    'Created By': task.created_by?.name || '',
    Team: task.team?.name || '',
    'Due Date': task.due_date ? new Date(task.due_date).toLocaleDateString() : '',
    'Created At': task.created_at ? new Date(task.created_at).toLocaleDateString() : '',
  };
}

/**
 * Export tasks as CSV, streaming the response directly.
 * @param {Object[]} tasks
 * @param {import('express').Response} res
 */
function exportCsv(tasks, res) {
  const filename = `tasks-export-${Date.now()}.csv`;

  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');

  const csvStream = csvFormat({ headers: true });
  csvStream.pipe(res);

  for (const task of tasks) {
    csvStream.write(flattenTask(task));
  }

  csvStream.end();

  logger.info('CSV export completed', { rows: tasks.length, filename });
}

/**
 * Export tasks as JSON.
 * @param {Object[]} tasks
 * @param {import('express').Response} res
 */
function exportJson(tasks, res) {
  const filename = `tasks-export-${Date.now()}.json`;

  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/json');

  res.json({ exported_at: new Date().toISOString(), total: tasks.length, tasks });

  logger.info('JSON export completed', { rows: tasks.length, filename });
}

/**
 * Export tasks as XLSX (Excel).
 * @param {Object[]} tasks
 * @param {import('express').Response} res
 */
function exportXlsx(tasks, res) {
  const filename = `tasks-export-${Date.now()}.xlsx`;

  const rows = tasks.map(flattenTask);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Tasks');

  // Auto-size columns
  const maxWidths = {};
  rows.forEach((row) => {
    Object.entries(row).forEach(([key, val]) => {
      maxWidths[key] = Math.max(maxWidths[key] || key.length, String(val).length);
    });
  });
  worksheet['!cols'] = Object.values(maxWidths).map((w) => ({ wch: Math.min(w + 2, 50) }));

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);

  logger.info('XLSX export completed', { rows: tasks.length, filename });
}

module.exports = { fetchTasksForExport, exportCsv, exportJson, exportXlsx };
