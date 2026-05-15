'use strict';

const jwt = require('jsonwebtoken');

// Set env before requiring modules that read it at load time
process.env.JWT_SECRET = 'test-secret-key-for-jest-only';
process.env.LARAVEL_API_URL = 'http://localhost:8000/api';
process.env.INTERNAL_SERVICE_TOKEN = 'test-token';

const { authenticate } = require('../../src/middleware/auth');

function makeReq(token) {
  return {
    headers: { authorization: token ? `Bearer ${token}` : undefined },
  };
}

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('authenticate middleware', () => {
  const secret = process.env.JWT_SECRET;

  it('rejects requests with no Authorization header', () => {
    const req = { headers: {} };
    const res = makeRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects an expired token', () => {
    const expired = jwt.sign({ sub: 1, role: 'admin' }, secret, { expiresIn: -1 });
    const req = makeReq(expired);
    const res = makeRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Token has expired.' }));
  });

  it('rejects an invalid token signature', () => {
    const bad = jwt.sign({ sub: 1, role: 'admin' }, 'wrong-secret');
    const req = makeReq(bad);
    const res = makeRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('accepts a valid token and populates req.user', () => {
    const valid = jwt.sign({ sub: 42, role: 'manager', name: 'Bob', email: 'bob@test.com' }, secret);
    const req = makeReq(valid);
    const res = makeRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toMatchObject({ id: 42, role: 'manager' });
  });
});

describe('authenticate middleware (token check)', () => {
  it('rejects when Authorization header is missing', () => {
    const req = { headers: {} };
    const res = makeRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes when a valid JWT is provided', () => {
    const token = jwt.sign({ sub: 1, role: 'admin' }, process.env.JWT_SECRET);
    const req = makeReq(token);
    const res = makeRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
