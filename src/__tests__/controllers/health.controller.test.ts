import request from 'supertest';
import { createApp } from '../../app';
import { HealthService } from '../../services/health.service';

// Mock the service layer
jest.mock('../../services/health.service', () => ({
  HealthService: {
    getHealthStatus: jest.fn(),
  },
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockGetHealthStatus = HealthService.getHealthStatus as jest.Mock;

describe('Health Controller', () => {
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /healthz', () => {
    it('should return 200 OK simply', async () => {
      const response = await request(app).get('/healthz');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });
  });

  describe('GET /api/v1/health', () => {
    it('should return 200 with complete health status', async () => {
      const mockStatus = {
        status: 'ok',
        database: 'connected',
        uptimeSeconds: 123.45,
        host: 'test-host',
      };
      mockGetHealthStatus.mockResolvedValue(mockStatus);

      const response = await request(app).get('/api/v1/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockStatus);
      expect(mockGetHealthStatus).toHaveBeenCalledTimes(1);
    });

    it('should handle service errors gracefully', async () => {
      mockGetHealthStatus.mockRejectedValue(new Error('Internal check failed'));

      const response = await request(app).get('/api/v1/health');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', 'Internal check failed');
    });
  });

  describe('Unknown routes', () => {
    it('should return 404 for unknown endpoints', async () => {
      const response = await request(app).get('/api/unknown-endpoint-xyz');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: 'Not Found' });
    });
  });
});
