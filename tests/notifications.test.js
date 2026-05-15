'use strict';

const request = require('supertest');
const app = require('../src/app');
const jwt = require('jsonwebtoken');

// Generate a test token
function makeToken(payload = {}) {
  const secret = process.env.JWT_SECRET || 'test-secret';
  return jwt.sign(
    { sub: 1, role: 'admin', name: 'Admin', email: 'admin@test.com', ...payload },
    secret,
    { expiresIn: '1h' }
  );
}

describe('Notifications API', () => {
  const adminToken = makeToken({ role: 'admin' });

  it('POST /api/notifications/send — returns 202 for valid payload', async () => {
    const res = await request(app)
      .post('/api/notifications/send')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        task_id: 1,
        user_id: 2,
        event_type: 'assigned',
        details: { task_title: 'Test Task' },
      });

    expect(res.status).toBe(202);
    expect(res.body.queued).toBe(true);
  });

  it('POST /api/notifications/send — returns 422 when task_id missing', async () => {
    const res = await request(app)
      .post('/api/notifications/send')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ user_id: 1, event_type: 'assigned' });

    expect(res.status).toBe(422);
  });

  it('POST /api/notifications/send — returns 422 for invalid event_type', async () => {
    const res = await request(app)
      .post('/api/notifications/send')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ task_id: 1, user_id: 1, event_type: 'invalid_event' });

    expect(res.status).toBe(422);
  });

  it('POST /api/notifications/send — returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/notifications/send')
      .send({ task_id: 1, user_id: 1, event_type: 'assigned' });

    expect(res.status).toBe(401);
  });
});

describe('Health check', () => {
  it('GET /health — returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
