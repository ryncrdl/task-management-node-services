'use strict';

process.env.JWT_SECRET = 'test-secret-key-for-jest-only';
process.env.LARAVEL_API_URL = 'http://localhost:8000/api';
process.env.INTERNAL_SERVICE_TOKEN = 'test-token';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');

function makeToken(payload = { sub: 1, role: 'admin' }) {
  return jwt.sign(payload, process.env.JWT_SECRET);
}

describe('GET /health', () => {
  it('returns 200 with service info', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', service: 'node-services' });
  });
});

describe('POST /api/notifications/send', () => {
  it('returns 422 when task_id is missing', async () => {
    const res = await request(app)
      .post('/api/notifications/send')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ event_type: 'assigned' });

    expect(res.status).toBe(422);
  });

  it('returns 202 for a valid notification payload', async () => {
    const res = await request(app)
      .post('/api/notifications/send')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ task_id: 1, user_id: 2, event_type: 'assigned', details: { task_title: 'Test' } });

    expect([200, 202]).toContain(res.status);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .post('/api/notifications/send')
      .send({ task_id: 1, event_type: 'assigned' });

    expect(res.status).toBe(401);
  });
});

describe('POST /api/broadcast', () => {
  it('returns 400 when event or room is missing', async () => {
    const res = await request(app)
      .post('/api/broadcast')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ event: 'task:updated' }); // missing room

    expect(res.status).toBe(400);
  });

  it('returns 503 when Socket.io is not attached', async () => {
    // app.js doesn't have io set (only server.js sets it), so expect 503
    const res = await request(app)
      .post('/api/broadcast')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ event: 'task:updated', room: 'task:1', data: {} });

    expect(res.status).toBe(503);
  });
});

describe('404 handler', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
  });
});
