'use strict';

const jwt = require('jsonwebtoken');

// Mock laravelApiClient to avoid real HTTP calls in tests
jest.mock('../src/services/laravelApiClient', () => ({
  getTeamTasks: jest.fn(),
}));

const laravelApi = require('../src/services/laravelApiClient');
const cacheService = require('../src/services/cacheService');
const analyticsService = require('../src/services/analyticsService');

beforeEach(() => {
  cacheService.clear();
  jest.clearAllMocks();
});

const mockTasks = [
  { id: 1, status: 'completed', priority: 'high', assigned_to: { id: 1, name: 'Alice', email: 'alice@test.com' }, created_at: '2024-01-01T08:00:00Z', updated_at: '2024-01-02T10:00:00Z' },
  { id: 2, status: 'pending', priority: 'medium', assigned_to: { id: 1, name: 'Alice', email: 'alice@test.com' }, created_at: '2024-01-03T08:00:00Z', updated_at: '2024-01-03T08:00:00Z' },
  { id: 3, status: 'in_progress', priority: 'low', assigned_to: { id: 2, name: 'Bob', email: 'bob@test.com' }, created_at: '2024-01-04T08:00:00Z', updated_at: '2024-01-04T08:00:00Z' },
  { id: 4, status: 'cancelled', priority: 'high', assigned_to: null, created_at: '2024-01-05T08:00:00Z', updated_at: '2024-01-05T08:00:00Z' },
];

describe('analyticsService.getTaskSummary', () => {
  beforeEach(() => {
    laravelApi.getTeamTasks.mockResolvedValue({ data: mockTasks });
  });

  it('calculates correct total_tasks count', async () => {
    const result = await analyticsService.getTaskSummary(1, null, null, 'token');
    expect(result.total_tasks).toBe(4);
  });

  it('calculates correct completed_tasks count', async () => {
    const result = await analyticsService.getTaskSummary(1, null, null, 'token');
    expect(result.completed_tasks).toBe(1);
  });

  it('calculates correct pending_tasks count', async () => {
    const result = await analyticsService.getTaskSummary(1, null, null, 'token');
    expect(result.pending_tasks).toBe(1);
  });

  it('calculates completion_rate correctly', async () => {
    const result = await analyticsService.getTaskSummary(1, null, null, 'token');
    expect(result.completion_rate).toBe(25); // 1/4 = 25%
  });

  it('returns cached result on second call', async () => {
    await analyticsService.getTaskSummary(1, null, null, 'token');
    await analyticsService.getTaskSummary(1, null, null, 'token');
    expect(laravelApi.getTeamTasks).toHaveBeenCalledTimes(1); // Second call uses cache
  });
});

describe('analyticsService.getTeamProductivity', () => {
  beforeEach(() => {
    laravelApi.getTeamTasks.mockResolvedValue({ data: mockTasks });
  });

  it('returns per-user stats', async () => {
    const result = await analyticsService.getTeamProductivity(1, 'token');
    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBe(2); // Alice and Bob (unassigned task excluded)
  });

  it('Alice has correct completion rate (1 completed out of 2)', async () => {
    const result = await analyticsService.getTeamProductivity(1, 'token');
    const alice = result.find((u) => u.user_name === 'Alice');
    expect(alice.completion_rate).toBe(50);
    expect(alice.total_tasks).toBe(2);
    expect(alice.completed_tasks).toBe(1);
  });
});
