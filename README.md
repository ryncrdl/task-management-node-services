# Task Management — Node.js Services

Backend services for the Task Management & Analytics Platform, built with **Node.js / Express**.

Handles: **Email Notifications**, **Analytics**, **Data Exports**, and **Scheduled Cron Jobs**.

---

## Live URLs

| Service | URL |
|---|---|
| **Service Base** | `https://task-management-node-services.onrender.com` |
| **Health Check** | `https://task-management-node-services.onrender.com/health` |
| **GitHub** | `https://github.com/ryncrdl/task-management-node-services` |

---

## Companion Repositories

| Service | GitHub |
|---|---|
| Laravel API | `https://github.com/ryncrdl/task-management-laravel-api` |
| React Frontend | `https://github.com/ryncrdl/task-management-react` |

---

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| Node.js | 20+ | Runtime |
| Express | ^4.19 | HTTP server |
| jsonwebtoken | ^9.0 | JWT validation |
| Nodemailer | ^6.9 | SMTP email |
| Resend | latest | Email fallback (on SMTP timeout) |
| node-cron | ^3.0 | Scheduled jobs |
| fast-csv | ^5.0 | CSV export |
| xlsx | ^0.18 | Excel export |
| axios | ^1.7 | HTTP client (calls Laravel API) |
| Socket.io | ^4.8 | WebSocket real-time events |
| winston | ^3.13 | Structured logging |
| Jest + Supertest | ^29 / ^7 | Testing |

---

## Local Setup

### Prerequisites
- Node.js 20+
- npm
- Laravel API running locally (see companion repo)

### 1 · Clone & Install

```bash
git clone https://github.com/ryncrdl/task-management-node-services.git
cd task-management-node-services
npm install
```

### 2 · Environment

```bash
cp .env.example .env
```

Edit `.env` with your local values:

```dotenv
LARAVEL_API_URL=http://localhost:8000/api

# Must be the SAME value as Laravel's JWT_SECRET
JWT_SECRET=your-jwt-secret

# Must match Laravel's NODE_SERVICE_SECRET
INTERNAL_SERVICE_SECRET=your-inter-service-secret

# SMTP (Gmail, Mailtrap, etc.)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your-email@gmail.com
MAIL_PASS=your-app-password

# Resend fallback (used when SMTP connection times out)
RESEND_API_KEY=your-resend-api-key
```

### 3 · Start

```bash
# Production
npm start

# Development (auto-reload)
npm run dev

# Service available at http://localhost:3000
```

---

## Test Credentials

```
Admin:   admin@test.com    / password123
Manager: manager@test.com  / password123
Member:  member@test.com   / password123
```

*(Same credentials as the Laravel API — JWT is shared)*

---

## Running Tests

```bash
npm test                   # All tests
npm test -- --coverage     # With coverage report
npm test -- --watch        # Watch mode
```

---

## API Reference

### Health

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/health` | — | Service health check |

### Notifications

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/notifications/send` | JWT | Queue a task notification (called by Laravel) |

**Request body:**
```json
{
  "task_id": 1,
  "user_id": 2,
  "event_type": "assigned",
  "details": { "task_title": "Fix login bug", "assigned_by": "Admin User" }
}
```

Supported `event_type` values: `assigned`, `status_changed`, `mentioned`, `deactivated`, `reactivated`

### Analytics *(Admin / Manager only)*

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/analytics/task-summary?team_id=1` | Task counts + avg completion time |
| GET | `/api/analytics/team-productivity?team_id=1` | Per-user task stats |
| GET | `/api/analytics/upcoming-deadlines?team_id=1` | Tasks due in next 7 days |

Results are cached for 1 hour (in-memory).

### Export *(Admin / Manager only)*

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/export/tasks` | Download tasks as CSV, JSON, or XLSX |

**Request body:**
```json
{
  "team_id": 1,
  "format": "csv",
  "filters": { "status": "completed", "date_from": "2026-01-01" }
}
```

### Cron Admin *(Admin only)*

| Method | Endpoint | Description |
|---|---|---|
| GET  | `/api/cron/status` | List all scheduled jobs + status |
| POST | `/api/cron/restart` | Stop and restart all cron jobs |
| POST | `/api/cron/trigger/notification-processor` | Manually run notification processor |
| POST | `/api/cron/trigger/daily-digest` | Manually run daily digest |
| POST | `/api/cron/trigger/deadline-reminder` | Manually run deadline reminder |
| POST | `/api/cron/trigger/task-cleanup` | Manually run task cleanup |

---

## Scheduled Jobs

| Job | Schedule | Description |
|---|---|---|
| Notification Processor | Every 30 seconds | Process queued email notification jobs |
| Daily Digest | `0 8 * * *` (08:00 UTC) | Email each user their incomplete tasks |
| Deadline Reminder | `0 */2 * * *` (every 2 h) | Alert assigned users of tasks due in 24 h |
| Task Cleanup | `0 0 * * *` (midnight UTC) | Soft-delete cancelled tasks older than 30 days |

All jobs can be manually triggered from the React admin **Cron Jobs** page.

### Notification Queue Architecture

```
Laravel → POST /api/notifications/send
            ↓
   Stored in PostgreSQL (notification_jobs table)
            ↓
   Processor polls every 30 s (claims batch atomically)
            ↓
   Sends email via SMTP → falls back to Resend on timeout
            ↓
   Job status updated: sent | failed
```

---

## Email Fallback Strategy

1. **Primary:** Gmail SMTP (`smtp.gmail.com:587`) with 15 s timeout
2. **Fallback:** [Resend](https://resend.com) HTTP API — triggered automatically on `ECONNREFUSED`, `ETIMEDOUT`, `ECONNRESET`, or connection timeout errors
3. Invalid recipient addresses are skipped with a warning log (never throw)

---

## WebSocket Events (Socket.io)

Clients connect to `http://localhost:3000` with a valid JWT.

| Event | Direction | Payload |
|---|---|---|
| `task:assigned` | Server → Client | `{ task_id, title, assigned_to }` |
| `task:status_changed` | Server → Client | `{ task_id, old_status, new_status }` |
| `notification:new` | Server → Client | `{ event_type, details }` |

---

## Deployment (Render.com)

1. Create a **Web Service** and connect `ryncrdl/task-management-node-services`
2. **Build Command:** `npm install`
3. **Start Command:** `npm start`
4. Add all environment variables from `.env.example` (fill in real values)
5. Ensure `NODE_ENV=production`
6. **No separate worker needed** — cron jobs run within the same process

> Free-tier services sleep after 15 min of inactivity.
> Use [cron-job.org](https://cron-job.org) to ping `GET /health` every 10 min.

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | HTTP port (default: `3000`) |
| `NODE_ENV` | No | `development` or `production` |
| `LARAVEL_API_URL` | **Yes** | Laravel API base URL |
| `JWT_SECRET` | **Yes** | Shared with Laravel — must match exactly |
| `INTERNAL_SERVICE_SECRET` | **Yes** | Secret for Node → Laravel internal calls |
| `INTERNAL_SERVICE_TOKEN` | No | Long-lived admin JWT for legacy use |
| `MAIL_HOST` | **Yes** | SMTP host (e.g., `smtp.gmail.com`) |
| `MAIL_PORT` | **Yes** | SMTP port (e.g., `587`) |
| `MAIL_USER` | **Yes** | SMTP username |
| `MAIL_PASS` | **Yes** | SMTP password / app password |
| `MAIL_FROM` | **Yes** | Sender address |
| `MAIL_FROM_NAME` | No | Sender display name |
| `RESEND_API_KEY` | No | Resend API key — enables SMTP fallback |
| `RESEND_FROM` | No | Resend sender (default: `onboarding@resend.dev`) |
| `REDIS_URL` | No | Redis for cache (falls back to in-memory) |
| `ANALYTICS_CACHE_TTL` | No | Analytics cache in seconds (default: `3600`) |
| `LOG_LEVEL` | No | Winston log level (default: `info`) |

---

## Security Notes

- JWT validated against the same secret as Laravel (shared-secret model)
- `X-Service-Secret` header authenticates internal Node → Laravel calls
- Rate limiting on notification endpoints to prevent spam
- Helmet middleware for HTTP security headers
- CORS configured with explicit origin allow-list
- Email errors logged but never thrown — one bad recipient does not block others
- No secrets hardcoded — all via `.env`
