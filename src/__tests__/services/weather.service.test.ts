import axios from 'axios';

// Mock axios before importing the module
jest.mock('axios', () => ({
  get: jest.fn(),
  isAxiosError: jest.fn(),
}));

// Mock env config
jest.mock('../../config/env', () => ({
  env: {
    googleMapsApiKey: 'test-api-key',
  },
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Mock prisma
jest.mock('../../clients/prisma', () => ({
  prisma: { $disconnect: jest.fn() },
}));

import { WeatherService } from '../../services/weather.service';

const mockAxiosGet = axios.get as jest.Mock;
const mockIsAxiosError = axios.isAxiosError as unknown as jest.Mock;

describe('WeatherService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAxiosError.mockReturnValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getCurrentWeather', () => {
    const mockResponse = {
      data: {
        currentTime: '2025-06-15T10:00:00Z',
        temperature: { degrees: 32 },
        relativeHumidity: 75,
        wind: { speed: { value: 10 } },
        precipitation: { qpf: { quantity: 0.5 } },
        weatherCondition: {
          type: 'PARTLY_CLOUDY',
          description: { text: 'Partly cloudy' },
        },
      },
    };

    it('should return current weather data', async () => {
      mockAxiosGet.mockResolvedValue(mockResponse);

      const result = await WeatherService.getCurrentWeather(13.75, 100.5);

      expect(result.temperatureC).toBe(32);
      expect(result.humidityPct).toBe(75);
      expect(result.windSpeedKph).toBe(10);
      expect(result.rainMm).toBe(0.5);
      expect(result.weatherCode).toBe(2); // PARTLY_CLOUDY → WMO 2
      expect(result.conditionText).toBe('Partly cloudy');
    });

    it('should call Google Weather API with correct params', async () => {
      mockAxiosGet.mockResolvedValue(mockResponse);

      await WeatherService.getCurrentWeather(14.0, 100.0);

      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining('currentConditions:lookup'),
        expect.objectContaining({
          params: expect.objectContaining({
            key: 'test-api-key',
            'location.latitude': 14.0,
            'location.longitude': 100.0,
          }),
        }),
      );
    });

    it('should throw on incomplete API response', async () => {
      mockAxiosGet.mockResolvedValue({ data: {} });

      await expect(WeatherService.getCurrentWeather(13.751, 100.501))
        .rejects.toThrow('Weather API returned incomplete data');
    });

    it('should throw formatted error on axios error', async () => {
      const axiosError = {
        response: { status: 403, data: 'API key invalid' },
        message: 'Request failed',
      };
      mockAxiosGet.mockRejectedValue(axiosError);
      mockIsAxiosError.mockReturnValue(true);

      await expect(WeatherService.getCurrentWeather(13.752, 100.502))
        .rejects.toThrow('Google Weather API error (403)');
    });

    it('should use cache on second call with same coordinates', async () => {
      mockAxiosGet.mockResolvedValue(mockResponse);

      const result1 = await WeatherService.getCurrentWeather(99.0, 99.0);
      const result2 = await WeatherService.getCurrentWeather(99.0, 99.0);

      // axios should only be called once due to caching
      expect(mockAxiosGet).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(result2);
    });

    it('should refresh cache after TTL expires', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-06-15T00:00:00Z'));
      mockAxiosGet.mockResolvedValue(mockResponse);

      await WeatherService.getCurrentWeather(88.0, 88.0);
      jest.setSystemTime(new Date('2025-06-15T00:16:00Z'));
      await WeatherService.getCurrentWeather(88.0, 88.0);

      expect(mockAxiosGet).toHaveBeenCalledTimes(2);
    });

    it('should use default values when optional fields are missing', async () => {
      mockAxiosGet.mockResolvedValue({
        data: {
          temperature: {},
          weatherCondition: { type: 'UNKNOWN_TYPE' },
        },
      });

      const result = await WeatherService.getCurrentWeather(12.341, 56.781);
      expect(result.temperatureC).toBe(0);
      expect(result.windSpeedKph).toBe(0);
      expect(result.rainMm).toBe(0);
      expect(result.weatherCode).toBe(0);
      expect(result.conditionText).toBe('Weather code 0');
      expect(result.time).toEqual(expect.any(String));
    });

    it('should stringify object response when axios error contains object payload', async () => {
      const axiosError = {
        response: { status: 500, data: { error: 'boom' } },
        message: 'Request failed',
      };
      mockAxiosGet.mockRejectedValue(axiosError);
      mockIsAxiosError.mockReturnValue(true);

      await expect(WeatherService.getCurrentWeather(12.342, 56.782)).rejects.toThrow(
        'Google Weather API error (500): {"error":"boom"}',
      );
    });

    it('should rethrow non-axios errors for current weather', async () => {
      mockAxiosGet.mockRejectedValue(new Error('plain failure'));
      mockIsAxiosError.mockReturnValue(false);

      await expect(WeatherService.getCurrentWeather(12.343, 56.783)).rejects.toThrow('plain failure');
    });
  });

  describe('getDailyForecast', () => {
    const mockForecastResponse = {
      data: {
        forecastDays: [
          {
            displayDate: { year: 2025, month: 6, day: 15 },
            maxTemperature: { degrees: 35 },
            minTemperature: { degrees: 25 },
            daytimeForecast: {
              weatherCondition: { type: 'RAIN', description: { text: 'Rain' } },
            },
          },
          {
            displayDate: { year: 2025, month: 6, day: 16 },
            maxTemperature: { degrees: 33 },
            minTemperature: { degrees: 24 },
            daytimeForecast: {
              weatherCondition: { type: 'CLEAR', description: { text: 'Clear' } },
            },
          },
        ],
      },
    };

    it('should return daily forecast data', async () => {
      mockAxiosGet.mockResolvedValue(mockForecastResponse);

      const result = await WeatherService.getDailyForecast(13.75, 100.5, 2);

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2025-06-15');
      expect(result[0].temperatureMaxC).toBe(35);
      expect(result[0].temperatureMinC).toBe(25);
      expect(result[0].temperatureMeanC).toBe(30);
      expect(result[0].weatherCode).toBe(63); // RAIN → WMO 63
    });

    it('should throw when no forecast data returned', async () => {
      mockAxiosGet.mockResolvedValue({ data: { forecastDays: [] } });

      await expect(WeatherService.getDailyForecast(13.75, 100.5))
        .rejects.toThrow('Weather API returned no daily forecast data');
    });

    it('should use nighttime forecast and fallback date when daytime and displayDate are missing', async () => {
      mockAxiosGet.mockResolvedValue({
        data: {
          forecastDays: [
            {
              maxTemperature: { degrees: 31 },
              minTemperature: { degrees: 21 },
              nighttimeForecast: {
                weatherCondition: { type: 'HEAVY_RAIN' },
              },
            },
          ],
        },
      });

      const result = await WeatherService.getDailyForecast(20.001, 30.001, 1);
      expect(result).toHaveLength(1);
      expect(result[0].weatherCode).toBe(65);
      expect(result[0].conditionText).toBe('Weather code 65');
      expect(result[0].date).toEqual(expect.any(String));
    });

    it('should use daily cache for repeated calls', async () => {
      mockAxiosGet.mockResolvedValue(mockForecastResponse);

      const first = await WeatherService.getDailyForecast(20.002, 30.002, 2);
      const second = await WeatherService.getDailyForecast(20.002, 30.002, 2);

      expect(mockAxiosGet).toHaveBeenCalledTimes(1);
      expect(second).toEqual(first);
    });

    it('should format axios network error without status for daily forecast', async () => {
      const axiosError = {
        response: undefined,
        message: 'timeout',
      };
      mockAxiosGet.mockRejectedValue(axiosError);
      mockIsAxiosError.mockReturnValue(true);

      await expect(WeatherService.getDailyForecast(20.003, 30.003, 1)).rejects.toThrow(
        'Google Weather API error (network): {}',
      );
    });

    it('should rethrow non-axios errors for daily forecast', async () => {
      mockAxiosGet.mockRejectedValue(new Error('daily plain failure'));
      mockIsAxiosError.mockReturnValue(false);

      await expect(WeatherService.getDailyForecast(20.004, 30.004, 1)).rejects.toThrow('daily plain failure');
    });
  });

  describe('getHourlyForecast', () => {
    const mockHourlyResponse = {
      data: {
        forecastHours: [
          {
            interval: { startTime: '2025-06-15T10:00:00Z' },
            temperature: { degrees: 30 },
            precipitation: { probability: { percent: 20 } },
            weatherCondition: { type: 'MOSTLY_CLEAR', description: { text: 'Mostly clear' } },
          },
        ],
      },
    };

    it('should return hourly forecast data', async () => {
      mockAxiosGet.mockResolvedValue(mockHourlyResponse);

      const result = await WeatherService.getHourlyForecast(13.75, 100.5, 1);

      expect(result).toHaveLength(1);
      expect(result[0].temperatureC).toBe(30);
      expect(result[0].precipitationProbability).toBe(20);
      expect(result[0].weatherCode).toBe(1); // MOSTLY_CLEAR → WMO 1
    });

    it('should throw when no hourly data returned', async () => {
      mockAxiosGet.mockResolvedValue({ data: { forecastHours: [] } });

      await expect(WeatherService.getHourlyForecast(13.75, 100.5))
        .rejects.toThrow('Weather API returned no hourly forecast data');
    });

    it('should use hourly defaults when optional fields are missing', async () => {
      mockAxiosGet.mockResolvedValue({
        data: {
          forecastHours: [
            {
              weatherCondition: { type: 'CLEAR' },
            },
          ],
        },
      });

      const result = await WeatherService.getHourlyForecast(10.101, 20.202, 1);

      expect(result[0].temperatureC).toBe(0);
      expect(result[0].precipitationProbability).toBe(0);
      expect(result[0].weatherCode).toBe(0);
      expect(result[0].conditionText).toBe('Weather code 0');
      expect(result[0].time).toEqual(expect.any(String));
    });

    it('should use hourly cache for repeated calls', async () => {
      mockAxiosGet.mockResolvedValue(mockHourlyResponse);

      const first = await WeatherService.getHourlyForecast(10.102, 20.203, 1);
      const second = await WeatherService.getHourlyForecast(10.102, 20.203, 1);

      expect(mockAxiosGet).toHaveBeenCalledTimes(1);
      expect(second).toEqual(first);
    });

    it('should use axios message when response data is empty string in hourly forecast error', async () => {
      const axiosError = {
        response: { status: 429, data: '' },
        message: 'rate limited',
      };
      mockAxiosGet.mockRejectedValue(axiosError);
      mockIsAxiosError.mockReturnValue(true);

      await expect(WeatherService.getHourlyForecast(10.103, 20.204, 1)).rejects.toThrow(
        'Google Weather API error (429): rate limited',
      );
    });

    it('should rethrow non-axios errors for hourly forecast', async () => {
      mockAxiosGet.mockRejectedValue(new Error('hourly plain failure'));
      mockIsAxiosError.mockReturnValue(false);

      await expect(WeatherService.getHourlyForecast(10.104, 20.205, 1)).rejects.toThrow('hourly plain failure');
    });
  });

  describe('getLocationName', () => {
    it('should return location info from Nominatim', async () => {
      mockAxiosGet.mockResolvedValue({
        data: {
          address: {
            suburb: 'วัฒนา',
            city: 'กรุงเทพมหานคร',
            country: 'ประเทศไทย',
          },
        },
      });

      const result = await WeatherService.getLocationName(13.75, 100.5);

      expect(result.district).toBe('วัฒนา');
      expect(result.city).toBe('กรุงเทพมหานคร');
      expect(result.name).toBe('วัฒนา, กรุงเทพมหานคร');
    });

    it('should return fallback on error', async () => {
      mockAxiosGet.mockRejectedValue(new Error('Network error'));

      const result = await WeatherService.getLocationName(13.75, 100.50);

      expect(result.name).toBe('13.75, 100.50');
      expect(result.district).toBe('');
      expect(result.city).toBe('');
    });

    it('should fallback to city name when district is missing', async () => {
      mockAxiosGet.mockResolvedValue({
        data: {
          address: {
            city: 'เชียงใหม่',
            country: 'ประเทศไทย',
          },
        },
      });

      const result = await WeatherService.getLocationName(18.79, 98.98);
      expect(result.name).toBe('เชียงใหม่');
      expect(result.district).toBe('');
      expect(result.city).toBe('เชียงใหม่');
      expect(result.country).toBe('ประเทศไทย');
    });

    it('should fallback to district and default country when city/country are missing', async () => {
      mockAxiosGet.mockResolvedValue({
        data: {
          address: {
            town: 'บ้านแหลม',
          },
        },
      });

      const result = await WeatherService.getLocationName(13.12, 100.11);
      expect(result.name).toBe('บ้านแหลม');
      expect(result.district).toBe('บ้านแหลม');
      expect(result.city).toBe('');
      expect(result.country).toBe('Thailand');
    });

    it('should return unknown location when nominatim returns no address fields', async () => {
      mockAxiosGet.mockResolvedValue({ data: {} });

      const result = await WeatherService.getLocationName(11.11, 22.22);
      expect(result.name).toBe('Unknown location');
      expect(result.country).toBe('Thailand');
    });
  });
});
