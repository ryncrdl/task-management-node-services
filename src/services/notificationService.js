'use strict';

const { emailTemplates, getTransporter } = require('../utils/emailTemplates');
const laravelApi = require('./laravelApiClient');
const config = require('../config');
const logger = require('../utils/logger');

// In-memory queue for async notification processing
const notificationQueue = [];
let isProcessing = false;

/**
 * Queue a notification job for async processing.
 * Returns immediately after adding to queue.
 */
function queueNotification(payload) {
  notificationQueue.push({
    ...payload,
    enqueuedAt: Date.now(),
    attempts: 0,
  });

  logger.info('Notification queued', {
    task_id: payload.task_id,
    user_id: payload.user_id,
    event_type: payload.event_type,
  });

  // Start processing if not already running
  if (!isProcessing) {
    processQueue();
  }
}

/**
 * Process the notification queue sequentially with retry logic.
 */
async function processQueue() {
  if (notificationQueue.length === 0) {
    isProcessing = false;
    return;
  }

  isProcessing = true;
  const job = notificationQueue.shift();

  try {
    await processNotification(job);
  } catch (err) {
    if (job.attempts < 3) {
      job.attempts++;
      logger.warn('Notification failed, requeueing', {
        task_id: job.task_id,
        attempt: job.attempts,
        error: err.message,
      });
      // Re-add to back of queue for retry
      notificationQueue.push(job);
    } else {
      logger.error('Notification permanently failed after 3 attempts', {
        task_id: job.task_id,
        error: err.message,
      });
    }
  }

  // Continue processing remaining jobs
  setImmediate(processQueue);
}

/**
 * Process a single notification job.
 * Fetches task/user details from Laravel and sends an email.
 */
async function processNotification(job) {
  const { task_id, user_id, event_type, details, token } = job;

  if (!user_id) {
    logger.debug('Notification skipped — no user assigned', { task_id });
    return;
  }

  // Fetch full task details from Laravel to get user email etc.
  let task;
  try {
    if (token) {
      task = await laravelApi.getTask(task_id, token);
    } else {
      // Use details provided inline (avoid extra HTTP call)
      task = { id: task_id, ...details };
    }
  } catch (err) {
    logger.warn('Could not fetch task details, using inline details', { task_id });
    task = { id: task_id, ...details };
  }

  const userName = task?.assigned_to?.name || `User #${user_id}`;
  const userEmail = task?.assigned_to?.email;

  if (!userEmail) {
    logger.warn('Cannot send notification — no email address for user', { user_id });
    return;
  }

  let emailContent;

  if (event_type === 'assigned') {
    emailContent = emailTemplates.taskAssigned({
      userName,
      taskTitle: task.title || details?.task_title || 'Task',
      taskDescription: task.description,
      teamName: task?.team?.name,
      dueDate: task.due_date || details?.due_date,
      taskUrl: null, // Set to frontend URL if available
    });
  } else if (event_type === 'status_changed') {
    emailContent = emailTemplates.statusChanged({
      userName,
      taskTitle: task.title || details?.task_title || 'Task',
      oldStatus: details?.old_status || 'unknown',
      newStatus: task.status || details?.task_status || 'unknown',
      teamName: task?.team?.name,
    });
  } else {
    logger.warn('Unknown event_type, skipping notification', { event_type });
    return;
  }

  await sendEmail(userEmail, emailContent.subject, emailContent.html);

  logger.info('Notification sent', {
    task_id,
    user_id,
    event_type,
    recipient: userEmail,
  });
}

/**
 * Send an email using Nodemailer.
 * Logs errors instead of throwing so caller isn't disrupted.
 */
async function sendEmail(to, subject, html) {
  const transporter = getTransporter();

  try {
    const info = await transporter.sendMail({
      from: `"${config.mail.fromName}" <${config.mail.from}>`,
      to,
      subject,
      html,
    });

    logger.info('Email sent', { messageId: info.messageId, to });
    return info;
  } catch (err) {
    logger.error('Email send failed', { to, subject, error: err.message });
    throw err; // Re-throw so the queue can retry
  }
}

/**
 * Send deadline reminder emails directly (called from cron job).
 */
async function sendDeadlineReminders(userTaskGroups) {
  for (const [userEmail, data] of Object.entries(userTaskGroups)) {
    try {
      const { userName, tasks } = data;
      const emailContent = emailTemplates.deadlineReminder({ userName, tasks });
      await sendEmail(userEmail, emailContent.subject, emailContent.html);
    } catch (err) {
      // Log but continue to other users
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
      const { userName, tasks } = data;
      const emailContent = emailTemplates.dailyDigest({ userName, tasks });
      await sendEmail(userEmail, emailContent.subject, emailContent.html);
    } catch (err) {
      logger.error('Daily digest failed', { userEmail, error: err.message });
    }
  }
}

module.exports = {
  queueNotification,
  processNotification,
  sendEmail,
  sendDeadlineReminders,
  sendDailyDigests,
};
