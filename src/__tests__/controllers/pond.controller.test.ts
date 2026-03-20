import request from 'supertest';
import { createApp } from '../../app';
import { PondService } from '../../services/pond.service';
import { signJwt } from '../../utils/jwt';
import { PondController } from '../../controllers/pond.controller';

// Mock dependencies
jest.mock('../../services/pond.service');
jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../config/env', () => ({
  env: { jwtSecret: 'test-secret' },
}));

const mockGetActiveCycle = PondService.getActiveCycle as jest.Mock;
const mockListCycles = PondService.listCycles as jest.Mock;
const mockCountCycles = PondService.countCycles as jest.Mock;
const mockCloseActiveCycle = PondService.closeActiveCycle as jest.Mock;
const mockStartNewCycle = PondService.startNewCycle as jest.Mock;

describe('Pond Controller', () => {
  const app = createApp();
  let authToken: string;

  beforeAll(() => {
    // Generate valid token for auth middleware routes (even if pond routes aren't all protected yet,
    // good practice if they become protected later)
    authToken = signJwt({ sub: 'farmer-id', provider: 'LOCAL', role: 'FARMER' });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/ponds/:id/active-cycle', () => {
    it('should return active cycle if found', async () => {
      mockGetActiveCycle.mockResolvedValue({ id: 'cycle-1', status: 'ACTIVE' });

      const response = await request(app).get('/api/ponds/pond-1/active-cycle');

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe('cycle-1');
      expect(mockGetActiveCycle).toHaveBeenCalledWith('pond-1');
    });

    it('should return 200 with null if no active cycle', async () => {
      mockGetActiveCycle.mockResolvedValue(null);

      const response = await request(app).get('/api/ponds/pond-1/active-cycle');

      expect(response.status).toBe(200);
      expect(response.body.data).toBeNull();
    });
  });

  describe('GET /api/ponds/:id/cycles', () => {
    it('should list cycles with default pagination', async () => {
      mockListCycles.mockResolvedValue([]);

      const response = await request(app).get('/api/ponds/pond-1/cycles');

      expect(response.status).toBe(200);
      expect(mockListCycles).toHaveBeenCalledWith('pond-1');
    });
  });

  describe('GET /api/ponds/:id/cycle-count', () => {
    it('should return total cycle count', async () => {
      mockCountCycles.mockResolvedValue(5);

      const response = await request(app).get('/api/ponds/pond-1/cycle-count');

      expect(response.status).toBe(200);
      expect(response.body.data.count).toBe(5);
      expect(mockCountCycles).toHaveBeenCalledWith('pond-1');
    });
  });

  describe('POST /api/ponds/:id/start-cycle', () => {
    it('should start a new cycle successfully', async () => {
      mockStartNewCycle.mockResolvedValue({ id: 'new-cycle' });

      const cycleData = {
        farmType: 'SMALL',
      };

      const response = await request(app)
        .post('/api/ponds/pond-1/start-cycle')
        .send(cycleData);

      expect(response.status).toBe(201);
      expect(response.body.data.id).toBe('new-cycle');
      
      expect(mockStartNewCycle).toHaveBeenCalledWith('pond-1', 'SMALL');
    });

    it('should allow missing farmType', async () => {
      mockStartNewCycle.mockResolvedValue({ id: 'new-cycle-with-default' });

      const response = await request(app)
        .post('/api/ponds/pond-1/start-cycle')
        .send({});

      expect(response.status).toBe(201);
      expect(mockStartNewCycle).toHaveBeenCalledWith('pond-1', undefined);
    });
  });

  describe('POST /api/ponds/:id/end-cycle', () => {
    it('should end a cycle successfully', async () => {
      mockCloseActiveCycle.mockResolvedValue({ id: 'cycle-1', status: 'HARVESTED' });

      const response = await request(app)
        .post('/api/ponds/pond-1/end-cycle')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe('cycle-1');
      expect(mockCloseActiveCycle).toHaveBeenCalledWith('pond-1');
    });

    it('should return 400 for missing pond id', async () => {
      const response = await request(app).post('/api/ponds//end-cycle').send({});

      expect(response.status).toBe(404);
    });
  });

  it('should forward missing-id errors to next for all controller methods', async () => {
    const req = { params: {}, body: {} } as any;
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() } as any;
    const next = jest.fn();

    await PondController.getActiveCycle(req, res, next);
    await PondController.endCycle(req, res, next);
    await PondController.listCycles(req, res, next);
    await PondController.getCycleCount(req, res, next);
    await PondController.startNewCycle(req, res, next);

    expect(next).toHaveBeenCalledTimes(5);
    for (const call of next.mock.calls) {
      expect(call[0]).toEqual(expect.objectContaining({ status: 400, message: 'Pond ID is required' }));
    }
  });

  it('should pass service errors to next in getActiveCycle', async () => {
    const req = { params: { id: 'pond-1' } } as any;
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() } as any;
    const next = jest.fn();
    const expectedError = new Error('service down');

    mockGetActiveCycle.mockRejectedValue(expectedError);
    await PondController.getActiveCycle(req, res, next);

    expect(next).toHaveBeenCalledWith(expectedError);
  });

});
