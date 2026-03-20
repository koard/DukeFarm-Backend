// Mock dependencies
jest.mock('../../clients/prisma', () => ({
  prisma: { $disconnect: jest.fn() },
}));

jest.mock('../../config/env', () => ({
  env: { jwtSecret: 'test-secret' },
}));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Mock the sub-dashboard services to avoid importing their Prisma dependencies
jest.mock('../../services/nursery-small-dashboard.service', () => ({
  NurserySmallDashboardService: { getDashboard: jest.fn().mockResolvedValue({ type: 'SMALL' }) },
}));
jest.mock('../../services/nursery-large-dashboard.service', () => ({
  NurseryLargeDashboardService: { getDashboard: jest.fn().mockResolvedValue({ type: 'LARGE' }) },
}));
jest.mock('../../services/growout-dashboard.service', () => ({
  GrowoutDashboardService: { getDashboard: jest.fn().mockResolvedValue({ type: 'MARKET' }) },
}));
jest.mock('../../services/admin-dashboard.service', () => ({
  AdminDashboardService: { getDashboardStats: jest.fn().mockResolvedValue({ type: 'ADMIN' }) },
}));

import { DashboardService } from '../../services/dashboard.service';
import { NurserySmallDashboardService } from '../../services/nursery-small-dashboard.service';
import { NurseryLargeDashboardService } from '../../services/nursery-large-dashboard.service';
import { GrowoutDashboardService } from '../../services/growout-dashboard.service';
import { AdminDashboardService } from '../../services/admin-dashboard.service';

describe('DashboardService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseFarmTypeParam', () => {
    it('should parse SMALL correctly', () => {
      expect(DashboardService.parseFarmTypeParam('SMALL')).toBe('SMALL');
    });

    it('should parse LARGE correctly', () => {
      expect(DashboardService.parseFarmTypeParam('LARGE')).toBe('LARGE');
    });

    it('should parse MARKET correctly', () => {
      expect(DashboardService.parseFarmTypeParam('MARKET')).toBe('MARKET');
    });

    it('should be case-insensitive', () => {
      expect(DashboardService.parseFarmTypeParam('small')).toBe('SMALL');
      expect(DashboardService.parseFarmTypeParam('Large')).toBe('LARGE');
      expect(DashboardService.parseFarmTypeParam('market')).toBe('MARKET');
    });

    it('should throw for undefined', () => {
      expect(() => DashboardService.parseFarmTypeParam(undefined)).toThrow('Missing farm type');
    });

    it('should throw for invalid farm type', () => {
      expect(() => DashboardService.parseFarmTypeParam('INVALID')).toThrow('Unsupported farm type: INVALID');
    });

    it('should throw for empty string', () => {
      expect(() => DashboardService.parseFarmTypeParam('')).toThrow('Missing farm type');
    });
  });

  describe('getDashboard', () => {
    it('should route ADMIN to AdminDashboardService', async () => {
      const result = await DashboardService.getDashboard('user-1', 'ADMIN', 'SMALL');

      expect(AdminDashboardService.getDashboardStats).toHaveBeenCalledWith(
        'SMALL',
        expect.any(Number),
      );
      expect(result).toEqual({ type: 'ADMIN' });
    });

    it('should route SMALL to NurserySmallDashboardService', async () => {
      const result = await DashboardService.getDashboard('user-1', 'FARMER', 'SMALL');

      expect(NurserySmallDashboardService.getDashboard).toHaveBeenCalledWith('user-1', undefined);
      expect(result).toEqual({ type: 'SMALL' });
    });

    it('should route LARGE to NurseryLargeDashboardService', async () => {
      const result = await DashboardService.getDashboard('user-1', 'FARMER', 'LARGE');

      expect(NurseryLargeDashboardService.getDashboard).toHaveBeenCalledWith('user-1', undefined);
      expect(result).toEqual({ type: 'LARGE' });
    });

    it('should route MARKET to GrowoutDashboardService', async () => {
      const result = await DashboardService.getDashboard('user-1', 'FARMER', 'MARKET');

      expect(GrowoutDashboardService.getDashboard).toHaveBeenCalledWith('user-1', undefined);
      expect(result).toEqual({ type: 'MARKET' });
    });

    it('should pass pondId to dashboard services', async () => {
      await DashboardService.getDashboard('user-1', 'FARMER', 'SMALL', 'pond-123');

      expect(NurserySmallDashboardService.getDashboard).toHaveBeenCalledWith('user-1', 'pond-123');
    });

    it('should throw for unknown farm type for farmer', async () => {
      await expect(DashboardService.getDashboard('user-1', 'FARMER', 'UNKNOWN'))
        .rejects.toThrow('Unknown group type: UNKNOWN');
    });

    it('should pass year to admin dashboard', async () => {
      await DashboardService.getDashboard('user-1', 'ADMIN', 'SMALL', undefined, 2024);

      expect(AdminDashboardService.getDashboardStats).toHaveBeenCalledWith('SMALL', 2024);
    });

    it('should throw for invalid farm type in admin mode', async () => {
      await expect(DashboardService.getDashboard('user-1', 'ADMIN', 'INVALID'))
        .rejects.toThrow('Invalid farm type for admin dashboard');
    });
  });
});
