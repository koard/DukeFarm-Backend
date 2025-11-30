import { HealthService } from '../../services/health.service';

describe('HealthService', () => {
  describe('getHealthStatus', () => {
    it('should return healthy status', async () => {
      const result = await HealthService.getHealthStatus();
      
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('database');
      expect(result).toHaveProperty('uptimeSeconds');
      expect(result).toHaveProperty('host');
      
      expect(['ok', 'degraded']).toContain(result.status);
      expect(['connected', 'unreachable']).toContain(result.database);
      expect(typeof result.uptimeSeconds).toBe('number');
      expect(result.uptimeSeconds).toBeGreaterThan(0);
      expect(typeof result.host).toBe('string');
    });

    it('should return uptime as number', async () => {
      const result = await HealthService.getHealthStatus();
      
      expect(typeof result.uptimeSeconds).toBe('number');
      expect(result.uptimeSeconds).toBeGreaterThan(0);
    });

    it('should return increasing uptime on successive calls', async () => {
      const result1 = await HealthService.getHealthStatus();
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result2 = await HealthService.getHealthStatus();
      
      expect(result2.uptimeSeconds).toBeGreaterThanOrEqual(result1.uptimeSeconds);
    });

    it('should include host information', async () => {
      const result = await HealthService.getHealthStatus();
      
      expect(result.host).toBeDefined();
      expect(typeof result.host).toBe('string');
      expect(result.host.length).toBeGreaterThan(0);
    });

    it('should check database connectivity', async () => {
      const result = await HealthService.getHealthStatus();
      
      expect(result.database).toBeDefined();
      expect(['connected', 'unreachable']).toContain(result.database);
      
      // If database is connected, status should be ok
      if (result.database === 'connected') {
        expect(result.status).toBe('ok');
      }
    });
  });
});
