// Mock prisma
jest.mock('../../clients/prisma', () => ({
  prisma: {
    farm: { findUnique: jest.fn() },
    productionCycle: { findUnique: jest.fn() },
    $disconnect: jest.fn(),
  },
}));

// Mock env (needed by jwt → env import chain)
jest.mock('../../config/env', () => ({
  env: { jwtSecret: 'test-secret' },
}));

import { AccessService } from '../../services/access.service';
import { prisma } from '../../clients/prisma';
import { AuthenticatedUser } from '../../middlewares/auth.middleware';
import { HttpError } from '../../utils/httpError';

const mockFarmFind = prisma.farm.findUnique as jest.Mock;
const mockCycleFind = prisma.productionCycle.findUnique as jest.Mock;

describe('AccessService', () => {
  const adminUser: AuthenticatedUser = {
    id: 'admin-id',
    provider: 'LOCAL',
    role: 'ADMIN',
  };

  const farmerUser: AuthenticatedUser = {
    id: 'farmer-id',
    provider: 'LINE',
    role: 'FARMER',
  };

  const otherUser: AuthenticatedUser = {
    id: 'other-id',
    provider: 'LINE',
    role: 'FARMER',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ensureFarmAccess', () => {
    it('should throw 404 when farm is not found', async () => {
      mockFarmFind.mockResolvedValue(null);

      await expect(AccessService.ensureFarmAccess('nonexistent-id', farmerUser))
        .rejects.toThrow(HttpError);

      try {
        await AccessService.ensureFarmAccess('nonexistent-id', farmerUser);
      } catch (e) {
        expect((e as HttpError).status).toBe(404);
        expect((e as HttpError).message).toBe('Farm not found');
      }
    });

    it('should allow access when user is the farm owner', async () => {
      mockFarmFind.mockResolvedValue({ id: 'farm-1', ownerId: 'farmer-id' });

      const result = await AccessService.ensureFarmAccess('farm-1', farmerUser);

      expect(result).toEqual({ id: 'farm-1', ownerId: 'farmer-id' });
    });

    it('should allow access when user is ADMIN', async () => {
      mockFarmFind.mockResolvedValue({ id: 'farm-1', ownerId: 'someone-else' });

      const result = await AccessService.ensureFarmAccess('farm-1', adminUser);

      expect(result).toEqual({ id: 'farm-1', ownerId: 'someone-else' });
    });

    it('should throw 403 when user is not owner and not admin', async () => {
      mockFarmFind.mockResolvedValue({ id: 'farm-1', ownerId: 'farmer-id' });

      await expect(AccessService.ensureFarmAccess('farm-1', otherUser))
        .rejects.toThrow(HttpError);

      try {
        await AccessService.ensureFarmAccess('farm-1', otherUser);
      } catch (e) {
        expect((e as HttpError).status).toBe(403);
        expect((e as HttpError).message).toBe('Forbidden');
      }
    });

    it('should allow access for users in allowedRoles', async () => {
      const researcherUser: AuthenticatedUser = {
        id: 'researcher-id',
        provider: 'LOCAL',
        role: 'RESEARCHER',
      };
      mockFarmFind.mockResolvedValue({ id: 'farm-1', ownerId: 'farmer-id' });

      const result = await AccessService.ensureFarmAccess('farm-1', researcherUser, {
        allowRoles: ['RESEARCHER'],
      });

      expect(result).toBeDefined();
    });
  });

  describe('ensureCycleAccess', () => {
    it('should throw 404 when cycle is not found', async () => {
      mockCycleFind.mockResolvedValue(null);

      await expect(AccessService.ensureCycleAccess('nonexistent-id', farmerUser))
        .rejects.toThrow(HttpError);

      try {
        await AccessService.ensureCycleAccess('nonexistent-id', farmerUser);
      } catch (e) {
        expect((e as HttpError).status).toBe(404);
        expect((e as HttpError).message).toBe('Production cycle not found');
      }
    });

    it('should return cycle when found', async () => {
      const mockCycle = { id: 'cycle-1', initialStockCount: 100 };
      mockCycleFind.mockResolvedValue(mockCycle);

      const result = await AccessService.ensureCycleAccess('cycle-1', farmerUser);

      expect(result).toEqual(mockCycle);
    });

    it('should query with correct where clause', async () => {
      mockCycleFind.mockResolvedValue({ id: 'cycle-1', initialStockCount: 50 });

      await AccessService.ensureCycleAccess('cycle-1', farmerUser);

      expect(mockCycleFind).toHaveBeenCalledWith({
        where: { id: 'cycle-1' },
        select: { id: true, initialStockCount: true },
      });
    });
  });
});
