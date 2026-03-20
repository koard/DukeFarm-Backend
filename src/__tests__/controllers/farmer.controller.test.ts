import request from 'supertest';
import { createApp } from '../../app';
import { FarmerService } from '../../services/farmer.service';
import { signJwt } from '../../utils/jwt';

// Mock dependencies
jest.mock('../../services/farmer.service', () => ({
  FarmerService: {
    getFarmerList: jest.fn(),
    getFarmerById: jest.fn(),
    deleteFarmerById: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../config/env', () => ({
  env: { jwtSecret: 'test-secret' },
}));

// Mock Prisma
jest.mock('../../clients/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    $disconnect: jest.fn(),
  },
}));

import { prisma } from '../../clients/prisma';

const mockFarmerList = FarmerService.getFarmerList as jest.Mock;
const mockFarmerById = FarmerService.getFarmerById as jest.Mock;
const mockDeleteFarmer = FarmerService.deleteFarmerById as jest.Mock;
const mockUserFindUnique = prisma.user.findUnique as jest.Mock;

describe('Farmer Controller', () => {
  const app = createApp();
  let adminToken: string;
  let farmerToken: string;

  beforeAll(() => {
    adminToken = signJwt({ sub: 'admin-id', provider: 'LOCAL', role: 'ADMIN' });
    farmerToken = signJwt({ sub: 'farmer-id', provider: 'LOCAL', role: 'FARMER' });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/farmers', () => {
    beforeEach(() => {
      // Role middleware checks the database for the user's role
      mockUserFindUnique.mockResolvedValue({ id: 'admin-id', role: 'ADMIN' });
    });

    it('should deny access to non-admin/researcher roles', async () => {
      mockUserFindUnique.mockResolvedValue({ id: 'farmer-id', role: 'FARMER' });

      const response = await request(app)
        .get('/api/farmers')
        .set('Authorization', `Bearer ${farmerToken}`);

      expect(response.status).toBe(403);
    });

    it('should allow access to ADMIN role', async () => {
      mockFarmerList.mockResolvedValue({ data: [], pagination: {} });

      const response = await request(app)
        .get('/api/farmers')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(mockFarmerList).toHaveBeenCalledWith({ page: 1, limit: 10 });
    });

    it('should reject invalid pagination parameters', async () => {
      const response = await request(app)
        .get('/api/farmers?page=-1&limit=200')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid pagination');
    });

    it('should pass search and farmType filters to service', async () => {
      mockFarmerList.mockResolvedValue({ data: [], pagination: {} });

      await request(app)
        .get('/api/farmers?page=2&limit=50&search=john&farmType=LARGE')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(mockFarmerList).toHaveBeenCalledWith({
        page: 2,
        limit: 50,
        search: 'john',
        farmType: 'LARGE',
      });
    });
  });

  describe('GET /api/farmers/:farmerId', () => {
    beforeEach(() => {
      mockUserFindUnique.mockResolvedValue({ id: 'admin-id', role: 'ADMIN' });
    });

    it('should return farmer details', async () => {
      mockFarmerById.mockResolvedValue({ id: 'f1', name: 'John Doe' });

      const response = await request(app)
        .get('/api/farmers/f1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe('f1');
      expect(mockFarmerById).toHaveBeenCalledWith('f1', undefined);
    });

    it('should pass valid farmType to service', async () => {
      mockFarmerById.mockResolvedValue({ id: 'f1' });

      await request(app)
        .get('/api/farmers/f1?farmType=LARGE')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(mockFarmerById).toHaveBeenCalledWith('f1', 'LARGE');
    });
  });

  describe('DELETE /api/farmers/:farmerId', () => {
    it('should allow ADMIN to delete farmer', async () => {
      mockUserFindUnique.mockResolvedValue({ id: 'admin-id', role: 'ADMIN' });
      mockDeleteFarmer.mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/farmers/f1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Farmer deleted successfully');
      expect(mockDeleteFarmer).toHaveBeenCalledWith('f1');
    });
  });
});
