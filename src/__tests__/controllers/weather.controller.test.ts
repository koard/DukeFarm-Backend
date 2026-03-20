import request from 'supertest';
import { createApp } from '../../app';
import { WeatherService } from '../../services/weather.service';
import { signJwt } from '../../utils/jwt';

// Mock dependencies
jest.mock('../../services/weather.service', () => ({
  WeatherService: {
    getCurrentWeather: jest.fn(),
    getHourlyForecast: jest.fn(),
    getDailyForecast: jest.fn(),
    getLocationName: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Mock config for JWT
jest.mock('../../config/env', () => ({
  env: { jwtSecret: 'test-secret' },
}));

const mockGetCurrentWeather = WeatherService.getCurrentWeather as jest.Mock;
const mockGetHourlyForecast = WeatherService.getHourlyForecast as jest.Mock;
const mockGetDailyForecast = WeatherService.getDailyForecast as jest.Mock;
const mockGetLocationName = WeatherService.getLocationName as jest.Mock;

describe('Weather Controller', () => {
  const app = createApp();
  let authToken: string;

  beforeAll(() => {
    // Generate valid token for auth middleware
    authToken = signJwt({
      sub: 'test-user',
      provider: 'LOCAL',
      role: 'FARMER',
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const expectAuthRequired = async (endpoint: string) => {
    const response = await request(app).get(endpoint);
    expect(response.status).toBe(401);
  };

  const expectValidCoordinatesRequired = async (endpoint: string) => {
    const response = await request(app)
      .get(endpoint)
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message', 'lat and lng query params are required numbers');

    const responseInvalid = await request(app)
      .get(`${endpoint}?lat=abc&lng=def`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(responseInvalid.status).toBe(400);
  };

  describe('GET /api/v1/weather', () => {
    it('should require authentication', async () => {
      await expectAuthRequired('/api/v1/weather?lat=13.7&lng=100.5');
    });

    it('should require valid coordinates', async () => {
      await expectValidCoordinatesRequired('/api/v1/weather');
    });

    it('should return current weather data', async () => {
      const mockData = { temperatureC: 30, weatherCode: 1 };
      mockGetCurrentWeather.mockResolvedValue(mockData);

      const response = await request(app)
        .get('/api/v1/weather?lat=13.7&lng=100.5')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: mockData });
      expect(mockGetCurrentWeather).toHaveBeenCalledWith(13.7, 100.5);
    });

    it('should handle service errors', async () => {
      mockGetCurrentWeather.mockRejectedValue(new Error('Weather API failed'));

      const response = await request(app)
        .get('/api/v1/weather?lat=13.7&lng=100.5')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', 'Weather API failed');
    });
  });

  describe('GET /api/v1/weather/hourly', () => {
    it('should return hourly forecast data', async () => {
      mockGetHourlyForecast.mockResolvedValue([{ time: '2026-03-20T01:00:00Z', temperatureC: 30 }]);

      const response = await request(app)
        .get('/api/v1/weather/hourly?lat=13.7&lng=100.5&hours=12')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(mockGetHourlyForecast).toHaveBeenCalledWith(13.7, 100.5, 12);
    });
  });

  describe('GET /api/v1/weather/daily', () => {
    it('should return daily forecast data', async () => {
      mockGetDailyForecast.mockResolvedValue([{ date: '2026-03-21', temperatureMeanC: 29 }]);

      const response = await request(app)
        .get('/api/v1/weather/daily?lat=13.7&lng=100.5&days=5')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(mockGetDailyForecast).toHaveBeenCalledWith(13.7, 100.5, 5);
    });
  });

  describe('GET /api/v1/weather/location', () => {
    it('should return location data', async () => {
      mockGetLocationName.mockResolvedValue({ name: 'Bangkok', district: 'Watthana', city: 'Bangkok' });

      const response = await request(app)
        .get('/api/v1/weather/location?lat=13.7&lng=100.5')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(mockGetLocationName).toHaveBeenCalledWith(13.7, 100.5);
    });
  });

  describe('GET /api/v1/weather/complete', () => {
    it('should return complete weather payload', async () => {
      mockGetCurrentWeather.mockResolvedValue({ temperatureC: 30 });
      mockGetHourlyForecast.mockResolvedValue([{ time: '2026-03-20T01:00:00Z' }]);
      mockGetDailyForecast.mockResolvedValue([{ date: '2026-03-21' }]);
      mockGetLocationName.mockResolvedValue({ name: 'Bangkok' });

      const response = await request(app)
        .get('/api/v1/weather/complete?lat=13.7&lng=100.5')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('current');
      expect(response.body.data).toHaveProperty('hourly');
      expect(response.body.data).toHaveProperty('daily');
      expect(response.body.data).toHaveProperty('location');
    });
  });
});
