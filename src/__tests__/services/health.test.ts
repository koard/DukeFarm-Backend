import { HealthService } from '../../services/health.service';
import { prisma } from '../../clients/prisma';

jest.mock('../../clients/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn(),
    $disconnect: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockQueryRaw = prisma.$queryRaw as jest.Mock;

describe('HealthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getHealthStatus', () => {
    it('should return healthy status', async () => {
      mockQueryRaw.mockResolvedValue([1]);

      const result = await HealthService.getHealthStatus();
      
      expect(result.status).toBe('ok');
      expect(result.database).toBe('connected');
      expect(typeof result.uptimeSeconds).toBe('number');
      expect(typeof result.host).toBe('string');
    });

    it('should handle database error', async () => {
      mockQueryRaw.mockRejectedValue(new Error('Connection failed'));

      const result = await HealthService.getHealthStatus();
      
      expect(result.status).toBe('degraded');
      expect(result.database).toBe('unreachable');
      expect(typeof result.uptimeSeconds).toBe('number');
      expect(typeof result.host).toBe('string');
    });
  });
});
