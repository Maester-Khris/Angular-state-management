import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.hoisted(() => {
  process.env.NODE_JWT_SECRET = 'test-jwt-secret';
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.NODE_ENV = 'test';
});

const dbCrudOperator = require('../database/crud');
const analyticsService = require('../analytics/events-recorder');
const authMiddleware = require('../middleware/auth');

vi.spyOn(authMiddleware, 'authenticateJWT').mockImplementation((req, res, next) => {
  req.userId = 'user-uuid-123';
  req.userName = 'Test Writer';
  req.token = 'dummy-token';
  next();
});

const getUserProfileSpy = vi.spyOn(dbCrudOperator, 'getUserProfile');
const getUserDraftsSpy = vi.spyOn(dbCrudOperator, 'getUserDrafts');
const getUserFavoritesSpy = vi.spyOn(dbCrudOperator, 'getUserFavorites');
const getStatsSpy = vi.spyOn(analyticsService, 'getStats');

const { app } = require('../server');

describe('Profile — GET /profile/me/full-profile integration tests', () => {
  beforeEach(() => {
    getUserProfileSpy.mockReset();
    getUserDraftsSpy.mockReset();
    getUserFavoritesSpy.mockReset();
    getStatsSpy.mockReset();
  });

  it('GET /profile/me/full-profile — returns correct top-level shape and stats mapping', async () => {
    getUserProfileSpy.mockResolvedValue({
      useruuid: 'user-uuid-123',
      name: 'Test Writer',
      createdAt: '2024-05-15T00:00:00.000Z',
    });
    getStatsSpy.mockResolvedValue({
      totalPosts: 12,
      totalReach: 1500,
      totalCoAuthored: 3,
    });
    getUserDraftsSpy.mockResolvedValue([]);
    getUserFavoritesSpy.mockResolvedValue([]);

    const res = await request(app).get('/profile/me/full-profile');

    expect(res.status).toBe(200);
    expect(res.body.metadata).toHaveProperty('latency');
    expect(res.body.metadata.partialFailure).toBe(false);
    expect(res.body.data).toHaveProperty('profile');
    expect(res.body.data).toHaveProperty('stats');
    expect(res.body.data).toHaveProperty('drafts');
    expect(res.body.data).toHaveProperty('favorites');

    const { stats } = res.body.data;
    expect(stats.posts).toBe(12);
    expect(stats.reach).toBe('1500');
    expect(stats.coauth).toBe(3);
    expect(stats.since).toBe(2024);

    expect(stats).not.toHaveProperty('totalPosts');
    expect(stats).not.toHaveProperty('totalReach');
    expect(stats).not.toHaveProperty('totalCoAuthored');
  });

  it('GET /profile/me/full-profile — handles partial failure gracefully', async () => {
    getUserProfileSpy.mockResolvedValue({
      useruuid: 'user-uuid-123',
      name: 'Test Writer',
      createdAt: '2024-05-15T00:00:00.000Z',
    });
    getStatsSpy.mockResolvedValue({
      totalPosts: 5,
      totalReach: 100,
      totalCoAuthored: 0,
    });
    getUserDraftsSpy.mockResolvedValue([]);
    getUserFavoritesSpy.mockRejectedValue(new Error('DB failure'));

    const res = await request(app).get('/profile/me/full-profile');

    expect(res.status).toBe(200);
    expect(res.body.metadata.partialFailure).toBe(true);
    expect(res.body.data.favorites).toEqual([]);
  });
});
