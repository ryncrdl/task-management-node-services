'use strict';

const { emailTemplates } = require('../utils/emailTemplates');
const laravelApi = require('./laravelApiClient');
const config     = require('../config');
const logger     = require('../utils/logger');

/**
 * Persist a notification job to Laravel/PostgreSQL and return the new job id.
 */
async function queueNotification(payload) {
  const job = await laravelApi.createJob({
    task_id:    payload.task_id    ?? null,
    user_id:    payload.user_id    ?? null,
    event_type: payload.event_type,
    details:    payload.details    || {},
  });
  logger.info('Notification job queued', { job_id: job.id, event_type: payload.event_type });
  return job.id;
}

/**
 * Called by the cron job every minute.
 * Claims pending jobs from Laravel, processes them, then reports status back.
 */
async function processPendingJobs() {
  const jobs = await laravelApi.claimPendingJobs();
  if (jobs.length === 0) return;

  logger.info(`Processing ${jobs.length} notification job(s)`);

  for (const job of jobs) {
    try {
      await processNotification(job);
      await laravelApi.updateJobStatus(job.id, 'sent');
    } catch (err) {
      const currentAttempts = (job.attempts || 0) + 1; // +1 because Laravel will increment
      const newStatus = currentAttempts >= 3 ? 'failed' : 'pending';
      await laravelApi.updateJobStatus(job.id, newStatus, err.message);
      logger.warn('Notification job failed', { job_id: job.id, attempt: currentAttempts, error: err.message });
    }
  }
}

/**
 * Build and send the email for a single job row.
 */
async function processNotification(job) {
  const task_id    = job.task_id;
  const user_id    = job.user_id;
  const event_type = job.event_type;
  const details    = typeof job.details === 'string' ? JSON.parse(job.details) : (job.details || {});

  if (!user_id) {
    logger.debug('Notification skipped — no user_id', { task_id });
    return;
  }

  const userName  = details.assigned_to_name  || `User #${user_id}`;
  const userEmail = details.assigned_to_email;

  if (!userEmail) {
    throw new Error(`No email address for user #${user_id}`);
  }

  let emailContent;

  if (event_type === 'assigned') {
    emailContent = emailTemplates.taskAssigned({
      userName,
      taskTitle:       details.task_title,
      taskDescription: details.description,
      teamName:        details.team_name,
      priority:        details.priority,
      dueDate:         details.due_date,
      taskUrl:         task_id ? `${config.frontendUrl}/tasks/${task_id}` : null,
    });
  } else if (event_type === 'status_changed') {
    emailContent = emailTemplates.statusChanged({
      userName,
      taskTitle: details.task_title || 'Task',
      oldStatus: details.old_status || 'unknown',
      newStatus: details.task_status || 'unknown',
      teamName:  details.team_name,
      taskUrl:   task_id ? `${config.frontendUrl}/tasks/${task_id}` : null,
    });
  } else if (event_type === 'mentioned') {
    emailContent = emailTemplates.mentioned({
      userName,
      taskTitle:   details.task_title   || 'a task',
      teamName:    details.team_name,
      commentBody: details.comment_body || '',
      mentionedBy: details.mentioned_by || 'Someone',
      taskUrl:     task_id ? `${config.frontendUrl}/tasks/${task_id}` : null,
    });
  } else if (event_type === 'deactivated') {
    emailContent = emailTemplates.deactivated({
      userName,
      deactivatedBy: details.deactivated_by || 'an administrator',
    });
  } else if (event_type === 'reactivated') {
    emailContent = emailTemplates.reactivated({
      userName,
      reactivatedBy: details.reactivated_by || 'an administrator',
    });
  } else {
    throw new Error(`Unknown event_type: ${event_type}`);
  }

  await sendEmail(userEmail, emailContent.subject, emailContent.html);
  logger.info('Notification sent', { task_id, user_id, event_type, recipient: userEmail });
}

/**
 * Thin wrapper so callers get a log entry alongside the send.
 */
async function sendEmail(to, subject, html) {
  const { sendEmail: send } = require('../utils/emailTemplates');
  const result = await send(to, subject, html);
  logger.info('Email sent', { to });
  return result;
}

/**
 * Send deadline reminder emails directly (called from cron job).
 */
async function sendDeadlineReminders(userTaskGroups) {
  for (const [userEmail, data] of Object.entries(userTaskGroups)) {
    try {
      const emailContent = emailTemplates.deadlineReminder({ userName: data.userName, tasks: data.tasks });
      await sendEmail(userEmail, emailContent.subject, emailContent.html);
    } catch (err) {
      logger.error('Deadline reminder failed', { userEmail, error: err.message });
    }
  }
}

/**
 * Send daily digest emails (called from cron job).
 */
async function sendDailyDigests(userTaskGroups) {
  for (const [userEmail, data] of Object.entries(userTaskGroups)) {
    try {
      const emailContent = emailTemplates.dailyDigest({ userName: data.userName, tasks: data.tasks });
      await sendEmail(userEmail, emailContent.subject, emailContent.html);
    } catch (err) {
      logger.error('Daily digest failed', { userEmail, error: err.message });
    }
  }
}

module.exports = {
  queueNotification,
  processPendingJobs,
  processNotification,
  sendEmail,
  sendDeadlineReminders,
  sendDailyDigests,
};
