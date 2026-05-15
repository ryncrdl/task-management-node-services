'use strict';

const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Axios client pre-configured to call the Laravel API.
 * Passes the original user's JWT token for authenticated requests,
 * or uses the internal service secret for cron/internal calls.
 */

/**
 * Create an axios instance for a specific user token.
 * @param {string} token - JWT Bearer token
 */
function createUserClient(token) {
  return axios.create({
    baseURL: config.laravelApiUrl,
    timeout: 10000,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create an internal service client using the inter-service secret.
 * Used by cron jobs and background workers.
 */
const internalClient = axios.create({
  baseURL: config.laravelApiUrl,
  timeout: 15000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Service-Secret': config.internalServiceSecret,
  },
});

// Intercept errors for unified logging
[internalClient].forEach((client) => {
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      const status = error.response?.status;
      const url = error.config?.url;
      logger.error('Laravel API request failed', { url, status, message: error.message });
      return Promise.reject(error);
    }
  );
});

/**
 * Fetch task details from Laravel API.
 */
async function getTask(taskId, token) {
  const client = createUserClient(token);
  const { data } = await client.get(`/tasks/${taskId}`);
  return data.data;
}

/**
 * Fetch tasks for a team from Laravel API.
 */
async function getTeamTasks(teamId, filters = {}, token) {
  const client = createUserClient(token);
  const { data } = await client.get(`/teams/${teamId}/tasks`, { params: filters });
  return data;
}

/**
 * Fetch upcoming tasks due within 24 hours (internal call).
 */
async function getUpcomingDeadlines(adminToken) {
  const client = createUserClient(adminToken);
  const { data } = await client.get('/internal/tasks/upcoming-deadlines');
  return data.data || [];
}

/**
 * Fetch incomplete tasks grouped by user (internal call).
 */
async function getIncompleteTasksByUser(adminToken) {
  const client = createUserClient(adminToken);
  const { data } = await client.get('/internal/tasks/incomplete-by-user');
  return data.data || {};
}

/**
 * Fetch all teams.
 */
async function getTeams(token) {
  const client = createUserClient(token);
  const { data } = await client.get('/teams');
  return data.data || [];
}

/**
 * Enqueue a notification job via Laravel.
 */
async function createJob(payload) {
  const { data } = await internalClient.post('/internal/jobs', payload);
  return data;
}

/**
 * Claim pending notification jobs (marks them as 'processing' atomically).
 */
async function claimPendingJobs() {
  const { data } = await internalClient.get('/internal/jobs/pending');
  return data.data || [];
}

/**
 * Update a job's status after processing.
 */
async function updateJobStatus(jobId, status, errorMessage = null) {
  const { data } = await internalClient.patch(`/internal/jobs/${jobId}`, {
    status,
    error_message: errorMessage,
  });
  return data;
}

/**
 * Archive a task via Laravel API (internal, admin-only).
 */
async function archiveTask(taskId, adminToken) {
  const client = createUserClient(adminToken);
  const { data } = await client.delete(`/tasks/${taskId}/archive`);
  return data;
}

module.exports = {
  createUserClient,
  internalClient,
  getTask,
  getTeamTasks,
  getUpcomingDeadlines,
  getIncompleteTasksByUser,
  getTeams,
  archiveTask,
  createJob,
  claimPendingJobs,
  updateJobStatus,
};
