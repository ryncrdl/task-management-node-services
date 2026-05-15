# Task Management Node.js Services

Backend services for the Task Management & Analytics Platform, built with **Node.js / Express**.

Handles: **Notifications**, **Analytics**, **Data Exports**, and **Scheduled Jobs**.

## Live Deployment

> Update with your Render/Railway URL after deployment.

- **Service Base URL:** `https://your-node-app.render.com`
- **Health Check:** `https://your-node-app.render.com/health`

---

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| Node.js | 20+ | Runtime |
| Express | ^4.19 | HTTP server |
| jsonwebtoken | ^9.0 | JWT validation |
| Nodemailer | ^6.9 | Email notifications |
| node-cron | ^3.0 | Scheduled jobs |
| fast-csv | ^5.0 | CSV export |
| xlsx | ^0.18 | Excel export |
| axios | ^1.7 | HTTP client (calls Laravel) |
| winston | ^3.13 | Structured logging |
| Jest + Supertest | ^29/^7 | Testing |

---

## Local Setup

### Prerequisites

- Node.js 20+
- npm
- Running Laravel API (see sister repo)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-username/task-management-node-services.git
cd task-management-node-services

# 2. Install dependencies
npm install

# 3. Copy environment file
cp .env.example .env

# 4. Configure .env — especially:
#    LARAVEL_API_URL=http://localhost:8000/api
#    JWT_SECRET=<same value as Laravel's JWT_SECRET>
#    MAIL_HOST / MAIL_PORT / MAIL_USER / MAIL_PASS

# 5. Start the service
npm start
# or for development with auto-reload:
npm run dev
# Service available at http://localhost:3000
```

---

## Environment Variables

See `.env.example` for all required variables.

| Variable | Description |
|---|---|
| `PORT` | Port to listen on (default: 3000) |
| `JWT_SECRET` | **Must match** Laravel's `JWT_SECRET` |
| `LARAVEL_API_URL` | Laravel API base URL |
| `MAIL_HOST/PORT/USER/PASS` | SMTP credentials for Nodemailer |
| `ANALYTICS_CACHE_TTL` | Cache TTL in seconds (default: 3600) |

---

## Running Tests

```bash
npm test
# With coverage:
npm test -- --coverage
```

---

## API Endpoints

### Notifications

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/notifications/send` | JWT | Queue a task notification |

**Body:**
```json
{
  "task_id": 1,
  "user_id": 2,
  "event_type": "assigned",
  "details": { "task_title": "..." }
}
```

### Analytics (Admin/Manager only)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/analytics/task-summary?team_id=1` | Task counts + avg completion time |
| GET | `/api/analytics/team-productivity?team_id=1` | Per-user stats |
| GET | `/api/analytics/upcoming-deadlines?team_id=1` | Tasks due next 7 days |

### Export (Admin/Manager only)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/export/tasks` | Download tasks as CSV, JSON, or XLSX |

**Body:**
```json
{
  "team_id": 1,
  "format": "csv",
  "filters": { "status": "completed" }
}
```

---

## Scheduled Jobs (node-cron)

| Job | Schedule | Description |
|---|---|---|
| Daily Digest | `0 8 * * *` | Email each user their incomplete tasks |
| Deadline Reminder | `0 */2 * * *` | Alert users about tasks due in 24h |
| Task Cleanup | `0 0 * * *` | Archive cancelled tasks >30 days old |

---

## Deployment (Render.com)

1. Create a **Web Service** on Render
2. Connect your GitHub repository
3. Set **Build Command:** `npm install`
4. Set **Start Command:** `npm start`
5. Add all environment variables
6. Ensure `NODE_ENV=production`

> Cron jobs run within the same process — no separate worker needed.

---

## Security Considerations

- JWT validated against the same secret as Laravel (shared secret model)
- Rate limiting on notification endpoint to prevent spam
- Helmet middleware for HTTP security headers
- CORS configured with explicit origin allow-list
- No sensitive data hardcoded — all via `.env`
- Email errors logged but never thrown (fail-safe)
