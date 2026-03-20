import request from 'supertest';
import { createApp } from '../../app';
import { FeedFormulaService } from '../../services/feed-formula.service';
import { signJwt } from '../../utils/jwt';

jest.mock('../../services/feed-formula.service', () => ({
  FeedFormulaService: {
    createFeedFormula: jest.fn(),
    getFeedFormulaList: jest.fn(),
    getFeedFormulaById: jest.fn(),
    updateFeedFormula: jest.fn(),
    deleteFeedFormula: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../config/env', () => ({
  env: { jwtSecret: 'test-secret' },
}));

jest.mock('../../clients/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    $disconnect: jest.fn(),
  },
}));

import { prisma } from '../../clients/prisma';

const mockCreate = FeedFormulaService.createFeedFormula as jest.Mock;
const mockList = FeedFormulaService.getFeedFormulaList as jest.Mock;
const mockGetById = FeedFormulaService.getFeedFormulaById as jest.Mock;
const mockUpdate = FeedFormulaService.updateFeedFormula as jest.Mock;
const mockDelete = FeedFormulaService.deleteFeedFormula as jest.Mock;
const mockUserFindUnique = prisma.user.findUnique as jest.Mock;

describe('Feed Formula Controller', () => {
  const app = createApp();
  let adminToken: string;
  let farmerToken: string;

  beforeAll(() => {
    adminToken = signJwt({ sub: 'admin-id', provider: 'LOCAL', role: 'ADMIN' });
    farmerToken = signJwt({ sub: 'farmer-id', provider: 'LOCAL', role: 'FARMER' });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserFindUnique.mockImplementation(async ({ where }: any) => ({
      id: where.id,
      role: where.id === 'admin-id' ? 'ADMIN' : 'FARMER',
    }));
  });

  it('POST /api/feed-formulas should reject non-admin', async () => {
    const response = await request(app)
      .post('/api/feed-formulas')
      .set('Authorization', `Bearer ${farmerToken}`)
      .send({ name: 'A', targetStage: 'S1', foodType: 'PELLET' });

    expect(response.status).toBe(403);
  });

  it('POST /api/feed-formulas should validate required fields', async () => {
    const response = await request(app)
      .post('/api/feed-formulas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ targetStage: 'S1', foodType: 'PELLET' });

    expect(response.status).toBe(400);
  });

  it('POST /api/feed-formulas should create formula', async () => {
    mockCreate.mockResolvedValue({ id: 'f1' });

    const response = await request(app)
      .post('/api/feed-formulas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'สูตร 1', targetStage: 'S1', foodType: 'PELLET', farmType: 'SMALL' });

    expect(response.status).toBe(201);
    expect(response.body.data.id).toBe('f1');
    expect(mockCreate).toHaveBeenCalled();
  });

  it('POST /api/feed-formulas should reject invalid foodType', async () => {
    const response = await request(app)
      .post('/api/feed-formulas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'สูตร', targetStage: 'S1', foodType: 'UNKNOWN' });

    expect(response.status).toBe(400);
  });

  it('GET /api/feed-formulas should list with filters', async () => {
    mockList.mockResolvedValue({ data: [], pagination: {} });

    const response = await request(app)
      .get('/api/feed-formulas?page=1&limit=10&foodType=FRESH&farmType=SMALL')
      .set('Authorization', `Bearer ${farmerToken}`);

    expect(response.status).toBe(200);
    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 10, foodType: 'FRESH', farmType: 'SMALL' }),
    );
  });

  it('GET /api/feed-formulas should validate pagination params', async () => {
    const response = await request(app)
      .get('/api/feed-formulas?page=0&limit=101')
      .set('Authorization', `Bearer ${farmerToken}`);

    expect(response.status).toBe(400);
  });

  it('GET /api/feed-formulas/:id should return 404 when not found', async () => {
    mockGetById.mockResolvedValue(null);

    const response = await request(app)
      .get('/api/feed-formulas/f404')
      .set('Authorization', `Bearer ${farmerToken}`);

    expect(response.status).toBe(404);
  });

  it('PUT /api/feed-formulas/:id should update formula', async () => {
    mockUpdate.mockResolvedValue({ id: 'f1', name: 'updated' });

    const response = await request(app)
      .put('/api/feed-formulas/f1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'updated', farmType: null });

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe('f1');
  });

  it('PUT /api/feed-formulas/:id should return 404 for prisma P2025', async () => {
    const err: any = new Error('missing');
    err.code = 'P2025';
    mockUpdate.mockRejectedValue(err);

    const response = await request(app)
      .put('/api/feed-formulas/not-found')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'x' });

    expect(response.status).toBe(404);
  });

  it('PUT /api/feed-formulas/:id should reject invalid field types', async () => {
    const response = await request(app)
      .put('/api/feed-formulas/f1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nutrients: 123 });

    expect(response.status).toBe(400);
  });

  it('DELETE /api/feed-formulas/:id should return success', async () => {
    mockDelete.mockResolvedValue({ success: true });

    const response = await request(app)
      .delete('/api/feed-formulas/f1')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Feed formula deleted successfully');
  });

  it('DELETE /api/feed-formulas/:id should return 404 on prisma P2025', async () => {
    const err: any = new Error('missing');
    err.code = 'P2025';
    mockDelete.mockRejectedValue(err);

    const response = await request(app)
      .delete('/api/feed-formulas/unknown')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(404);
  });
});
