'use strict';

const nodemailer = require('nodemailer');
const config = require('../config');

/**
 * Returns compiled HTML email templates for task events.
 */
const emailTemplates = {
  taskAssigned: ({ userName, taskTitle, taskDescription, teamName, dueDate, taskUrl }) => ({
    subject: `[Task Management] New Task Assigned: ${taskTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .header { background: #2563EB; color: white; padding: 24px; text-align: center; }
            .body { padding: 32px; color: #374151; }
            .badge { display: inline-block; background: #EFF6FF; color: #2563EB; border-radius: 4px; padding: 4px 12px; font-size: 13px; font-weight: bold; }
            .cta { display: inline-block; margin-top: 24px; background: #2563EB; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; }
            .footer { background: #F9FAFB; padding: 16px; text-align: center; font-size: 12px; color: #9CA3AF; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin:0;font-size:22px;">📋 New Task Assigned</h1>
            </div>
            <div class="body">
              <p>Hi <strong>${userName}</strong>,</p>
              <p>A new task has been assigned to you:</p>
              <h2 style="color:#1E40AF;">${taskTitle}</h2>
              ${taskDescription ? `<p>${taskDescription}</p>` : ''}
              <p><span class="badge">Team: ${teamName || 'N/A'}</span></p>
              ${dueDate ? `<p>📅 <strong>Due:</strong> ${new Date(dueDate).toLocaleDateString()}</p>` : ''}
              ${taskUrl ? `<a href="${taskUrl}" class="cta">View Task →</a>` : ''}
            </div>
            <div class="footer">Task Management Platform — You're receiving this because you were assigned a task.</div>
          </div>
        </body>
      </html>
    `,
  }),

  statusChanged: ({ userName, taskTitle, oldStatus, newStatus, teamName }) => ({
    subject: `[Task Management] Task Status Updated: ${taskTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .header { background: #7C3AED; color: white; padding: 24px; text-align: center; }
            .body { padding: 32px; color: #374151; }
            .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: bold; }
            .footer { background: #F9FAFB; padding: 16px; text-align: center; font-size: 12px; color: #9CA3AF; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin:0;font-size:22px;">🔄 Task Status Updated</h1>
            </div>
            <div class="body">
              <p>Hi <strong>${userName}</strong>,</p>
              <p>The status of your task has been updated:</p>
              <h2 style="color:#5B21B6;">${taskTitle}</h2>
              <p>
                <span class="status" style="background:#FEF3C7;color:#92400E;">${oldStatus}</span>
                &nbsp;→&nbsp;
                <span class="status" style="background:#D1FAE5;color:#065F46;">${newStatus}</span>
              </p>
              <p><strong>Team:</strong> ${teamName || 'N/A'}</p>
            </div>
            <div class="footer">Task Management Platform</div>
          </div>
        </body>
      </html>
    `,
  }),

  deadlineReminder: ({ userName, tasks }) => ({
    subject: `[Task Management] ⚠️ Deadline Reminder — ${tasks.length} task(s) due soon`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; background: #f4f4f4; }
            .container { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .header { background: #DC2626; color: white; padding: 24px; text-align: center; }
            .body { padding: 32px; color: #374151; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #FEF2F2; text-align: left; padding: 8px 12px; font-size: 13px; color: #991B1B; }
            td { padding: 10px 12px; border-bottom: 1px solid #F3F4F6; font-size: 14px; }
            .footer { background: #F9FAFB; padding: 16px; text-align: center; font-size: 12px; color: #9CA3AF; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin:0;font-size:22px;">⚠️ Deadline Reminder</h1>
            </div>
            <div class="body">
              <p>Hi <strong>${userName}</strong>, the following tasks are due within 24 hours:</p>
              <table>
                <tr><th>Task</th><th>Priority</th><th>Due Date</th></tr>
                ${tasks.map(t => `
                  <tr>
                    <td>${t.title}</td>
                    <td>${t.priority}</td>
                    <td>${t.due_date ? new Date(t.due_date).toLocaleString() : 'N/A'}</td>
                  </tr>
                `).join('')}
              </table>
            </div>
            <div class="footer">Task Management Platform</div>
          </div>
        </body>
      </html>
    `,
  }),

  dailyDigest: ({ userName, tasks }) => ({
    subject: `[Task Management] Your Daily Task Digest — ${new Date().toLocaleDateString()}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; background: #f4f4f4; }
            .container { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 8px; overflow: hidden; }
            .header { background: #059669; color: white; padding: 24px; text-align: center; }
            .body { padding: 32px; color: #374151; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #ECFDF5; text-align: left; padding: 8px 12px; font-size: 13px; color: #065F46; }
            td { padding: 10px 12px; border-bottom: 1px solid #F3F4F6; font-size: 14px; }
            .footer { background: #F9FAFB; padding: 16px; text-align: center; font-size: 12px; color: #9CA3AF; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin:0;font-size:22px;">☀️ Daily Task Digest</h1>
              <p style="margin:4px 0 0;">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            <div class="body">
              <p>Hi <strong>${userName}</strong>, here are your open tasks for today:</p>
              ${tasks.length === 0
                ? '<p style="color:#6B7280;">🎉 No open tasks — great work!</p>'
                : `
                <table>
                  <tr><th>Task</th><th>Status</th><th>Priority</th><th>Due</th></tr>
                  ${tasks.map(t => `
                    <tr>
                      <td>${t.title}</td>
                      <td>${t.status}</td>
                      <td>${t.priority}</td>
                      <td>${t.due_date ? new Date(t.due_date).toLocaleDateString() : '—'}</td>
                    </tr>
                  `).join('')}
                </table>`
              }
            </div>
            <div class="footer">Task Management Platform</div>
          </div>
        </body>
      </html>
    `,
  }),
};

// Lazy-init transporter to allow testing without SMTP
let _transporter = null;

function getTransporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined,
    });
  }
  return _transporter;
}

module.exports = { emailTemplates, getTransporter };
