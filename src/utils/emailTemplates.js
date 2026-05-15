'use strict';

const nodemailer = require('nodemailer');
const config = require('../config');

// ─── Shared helpers ───────────────────────────────────────────────────────────

const BRAND_COLOR   = '#4f46e5';
const BRAND_NAME    = 'TaskFlow';

const PRIORITY_STYLE = {
  high:   { bg: '#fee2e2', color: '#b91c1c' },
  medium: { bg: '#fef9c3', color: '#92400e' },
  low:    { bg: '#dcfce7', color: '#15803d' },
};

const STATUS_STYLE = {
  pending:     { bg: '#fef9c3', color: '#92400e' },
  in_progress: { bg: '#dbeafe', color: '#1d4ed8' },
  completed:   { bg: '#dcfce7', color: '#15803d' },
  cancelled:   { bg: '#f3f4f6', color: '#6b7280' },
};

function priorityBadge(p = 'medium') {
  const s = PRIORITY_STYLE[p] || PRIORITY_STYLE.medium;
  return `<span style="display:inline-block;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:700;background:${s.bg};color:${s.color};">${p.charAt(0).toUpperCase() + p.slice(1)}</span>`;
}

function statusBadge(s = 'pending') {
  const st = STATUS_STYLE[s] || STATUS_STYLE.pending;
  const label = s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
  return `<span style="display:inline-block;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:700;background:${st.bg};color:${st.color};">${label}</span>`;
}

function infoRow(label, value) {
  return `
    <tr>
      <td style="padding:10px 16px;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;font-weight:600;white-space:nowrap;width:110px;">${label}</td>
      <td style="padding:10px 16px;font-size:14px;color:#111827;">${value}</td>
    </tr>`;
}

function base({ headerColor = BRAND_COLOR, headerIcon, headerTitle, headerSubtitle = '', preheader = '', body, footerNote = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${headerTitle}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#f3f4f6;">${preheader}</div>` : ''}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.10);">

        <!-- Brand top bar -->
        <tr><td style="background:${headerColor};padding:28px 36px;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td>
              <span style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-.3px;">${BRAND_NAME}</span>
            </td>
            <td align="right">
              <span style="font-size:28px;">${headerIcon}</span>
            </td>
          </tr></table>
          <p style="margin:10px 0 0;font-size:22px;font-weight:700;color:#ffffff;">${headerTitle}</p>
          ${headerSubtitle ? `<p style="margin:4px 0 0;font-size:14px;color:rgba(255,255,255,.8);">${headerSubtitle}</p>` : ''}
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px 36px;color:#374151;font-size:15px;line-height:1.6;">
          ${body}
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 36px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">
            © ${new Date().getFullYear()} ${BRAND_NAME} · Task Management Platform
          </p>
          ${footerNote ? `<p style="margin:6px 0 0;font-size:12px;color:#9ca3af;">${footerNote}</p>` : ''}
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Email templates ──────────────────────────────────────────────────────────

const emailTemplates = {

  taskAssigned: ({ userName, taskTitle, taskDescription, teamName, priority, dueDate, taskUrl }) => ({
    subject: `New task assigned to you: ${taskTitle}`,
    html: base({
      headerIcon: '📋',
      headerTitle: 'New Task Assigned',
      headerSubtitle: `You have a new task waiting for you`,
      preheader: `${taskTitle} has been assigned to you.`,
      footerNote: "You received this because a task was assigned to you. Please do not reply.",
      body: `
        <p style="margin:0 0 20px;">Hi <strong>${userName}</strong>,</p>
        <p style="margin:0 0 24px;">A new task has been assigned to you. Here are the details:</p>

        <!-- Task card -->
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
          <tr><td style="background:#f9fafb;padding:14px 16px;border-bottom:1px solid #e5e7eb;">
            <span style="font-size:16px;font-weight:700;color:#111827;">${taskTitle}</span>
          </td></tr>
          ${taskDescription ? `<tr><td style="padding:12px 16px;font-size:14px;color:#6b7280;border-bottom:1px solid #e5e7eb;">${taskDescription}</td></tr>` : ''}
          <tr><td style="padding:0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${infoRow('Team',     teamName   ? `<strong>${teamName}</strong>`   : '<span style="color:#9ca3af;">—</span>')}
              ${infoRow('Priority', priority ? priorityBadge(priority) : priorityBadge('medium'))}
              ${infoRow('Due Date', dueDate ? `<strong>${new Date(dueDate).toLocaleDateString('en-US', { weekday:'short', year:'numeric', month:'long', day:'numeric' })}</strong>` : '<span style="color:#9ca3af;">No due date</span>')}
            </table>
          </td></tr>
        </table>

        ${taskUrl ? `
        <table cellpadding="0" cellspacing="0"><tr><td>
          <a href="${taskUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;">View Task →</a>
        </td></tr></table>` : ''}
      `,
    }),
  }),

  statusChanged: ({ userName, taskTitle, oldStatus, newStatus, teamName, taskUrl }) => ({
    subject: `Task status updated: ${taskTitle}`,
    html: base({
      headerColor: '#7c3aed',
      headerIcon: '🔄',
      headerTitle: 'Task Status Updated',
      headerSubtitle: `${taskTitle}`,
      preheader: `Status changed from ${oldStatus} to ${newStatus}.`,
      footerNote: "You received this because a task assigned to you was updated.",
      body: `
        <p style="margin:0 0 20px;">Hi <strong>${userName}</strong>,</p>
        <p style="margin:0 0 24px;">The status of one of your tasks has been updated.</p>

        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
          <tr><td style="background:#f9fafb;padding:14px 16px;border-bottom:1px solid #e5e7eb;">
            <span style="font-size:16px;font-weight:700;color:#111827;">${taskTitle}</span>
          </td></tr>
          <tr><td style="padding:0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${infoRow('Team',       teamName ? `<strong>${teamName}</strong>` : '<span style="color:#9ca3af;">—</span>')}
              ${infoRow('Old Status', statusBadge(oldStatus))}
              ${infoRow('New Status', statusBadge(newStatus))}
            </table>
          </td></tr>
        </table>

        ${taskUrl ? `
        <table cellpadding="0" cellspacing="0"><tr><td>
          <a href="${taskUrl}" style="display:inline-block;background:#7c3aed;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;">View Task →</a>
        </td></tr></table>` : ''}
      `,
    }),
  }),

  deadlineReminder: ({ userName, tasks }) => ({
    subject: `⚠️ ${tasks.length} task${tasks.length > 1 ? 's' : ''} due within 24 hours`,
    html: base({
      headerColor: '#dc2626',
      headerIcon: '⏰',
      headerTitle: 'Deadline Reminder',
      headerSubtitle: `${tasks.length} task${tasks.length > 1 ? 's are' : ' is'} due within the next 24 hours`,
      preheader: `Don't miss your deadlines — ${tasks.length} task(s) due soon.`,
      footerNote: "You received this automated reminder from TaskFlow.",
      body: `
        <p style="margin:0 0 20px;">Hi <strong>${userName}</strong>,</p>
        <p style="margin:0 0 24px;">The following tasks are due within the next <strong>24 hours</strong>. Please take action soon:</p>

        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
          <tr style="background:#fef2f2;">
            <td style="padding:10px 16px;font-size:12px;font-weight:700;text-transform:uppercase;color:#991b1b;letter-spacing:.05em;">Task</td>
            <td style="padding:10px 16px;font-size:12px;font-weight:700;text-transform:uppercase;color:#991b1b;letter-spacing:.05em;">Priority</td>
            <td style="padding:10px 16px;font-size:12px;font-weight:700;text-transform:uppercase;color:#991b1b;letter-spacing:.05em;">Due</td>
          </tr>
          ${tasks.map((t, i) => `
          <tr style="background:${i % 2 === 0 ? '#ffffff' : '#fafafa'};">
            <td style="padding:12px 16px;font-size:14px;color:#111827;border-top:1px solid #f3f4f6;font-weight:600;">${t.title}</td>
            <td style="padding:12px 16px;border-top:1px solid #f3f4f6;">${priorityBadge(t.priority)}</td>
            <td style="padding:12px 16px;font-size:13px;color:#374151;border-top:1px solid #f3f4f6;">${t.due_date ? new Date(t.due_date).toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'}</td>
          </tr>`).join('')}
        </table>
      `,
    }),
  }),

  dailyDigest: ({ userName, tasks }) => {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const pending  = tasks.filter(t => t.status === 'pending').length;
    const progress = tasks.filter(t => t.status === 'in_progress').length;
    return {
      subject: `☀️ Your daily digest — ${tasks.length} open task${tasks.length !== 1 ? 's' : ''}`,
      html: base({
        headerColor: '#059669',
        headerIcon: '☀️',
        headerTitle: 'Daily Task Digest',
        headerSubtitle: today,
        preheader: `You have ${tasks.length} open task(s) today.`,
        footerNote: "This digest is sent automatically every morning.",
        body: `
          <p style="margin:0 0 20px;">Hi <strong>${userName}</strong>,</p>

          ${tasks.length === 0 ? `
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #d1fae5;border-radius:8px;background:#f0fdf4;margin-bottom:24px;">
            <tr><td style="padding:24px;text-align:center;">
              <p style="margin:0;font-size:32px;">🎉</p>
              <p style="margin:8px 0 0;font-size:16px;font-weight:700;color:#065f46;">All clear!</p>
              <p style="margin:4px 0 0;font-size:14px;color:#059669;">You have no open tasks today. Great work!</p>
            </td></tr>
          </table>` : `

          <!-- Summary pills -->
          <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr>
            <td style="padding-right:8px;"><span style="display:inline-block;padding:6px 14px;border-radius:99px;background:#fef9c3;color:#92400e;font-size:13px;font-weight:700;">${pending} Pending</span></td>
            <td style="padding-right:8px;"><span style="display:inline-block;padding:6px 14px;border-radius:99px;background:#dbeafe;color:#1d4ed8;font-size:13px;font-weight:700;">${progress} In Progress</span></td>
            <td><span style="display:inline-block;padding:6px 14px;border-radius:99px;background:#f3f4f6;color:#374151;font-size:13px;font-weight:700;">${tasks.length} Total</span></td>
          </tr></table>

          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
            <tr style="background:#ecfdf5;">
              <td style="padding:10px 16px;font-size:12px;font-weight:700;text-transform:uppercase;color:#065f46;letter-spacing:.05em;">Task</td>
              <td style="padding:10px 16px;font-size:12px;font-weight:700;text-transform:uppercase;color:#065f46;letter-spacing:.05em;">Status</td>
              <td style="padding:10px 16px;font-size:12px;font-weight:700;text-transform:uppercase;color:#065f46;letter-spacing:.05em;">Priority</td>
              <td style="padding:10px 16px;font-size:12px;font-weight:700;text-transform:uppercase;color:#065f46;letter-spacing:.05em;">Due</td>
            </tr>
            ${tasks.map((t, i) => `
            <tr style="background:${i % 2 === 0 ? '#ffffff' : '#fafafa'};">
              <td style="padding:12px 16px;font-size:14px;color:#111827;border-top:1px solid #f3f4f6;font-weight:600;">${t.title}</td>
              <td style="padding:12px 16px;border-top:1px solid #f3f4f6;">${statusBadge(t.status)}</td>
              <td style="padding:12px 16px;border-top:1px solid #f3f4f6;">${priorityBadge(t.priority)}</td>
              <td style="padding:12px 16px;font-size:13px;color:#6b7280;border-top:1px solid #f3f4f6;">${t.due_date ? new Date(t.due_date).toLocaleDateString('en-US', { month:'short', day:'numeric' }) : '—'}</td>
            </tr>`).join('')}
          </table>`}
        `,
      }),
    };
  },
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
