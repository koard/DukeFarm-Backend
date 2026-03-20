jest.mock('../../clients/prisma', () => ({
  prisma: {
    farmerProfile: { findUnique: jest.fn() },
    farmerCultivationType: { findFirst: jest.fn() },
    farmDataEntry: { findMany: jest.fn() },
  },
}));

jest.mock('../../services/pond.service', () => ({
  PondService: { getActiveCycle: jest.fn() },
}));

jest.mock('../../services/weather.service', () => ({
  WeatherService: {
    getCurrentWeather: jest.fn(),
    getDailyForecast: jest.fn(),
    getHourlyForecast: jest.fn(),
  },
}));

jest.mock('../../services/feeding-calculator.service', () => ({
  FeedingCalculator: {
    computeFeedAdjustment: jest.fn(),
    generateFeedingPlan: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { GrowoutDashboardService } from '../../services/growout-dashboard.service';
import { prisma } from '../../clients/prisma';
import { PondService } from '../../services/pond.service';
import { WeatherService } from '../../services/weather.service';
import { FeedingCalculator } from '../../services/feeding-calculator.service';

const mockProfile = prisma.farmerProfile.findUnique as jest.Mock;
const mockCultivation = prisma.farmerCultivationType.findFirst as jest.Mock;
const mockFindMany = prisma.farmDataEntry.findMany as jest.Mock;
const mockGetCycle = PondService.getActiveCycle as jest.Mock;
const mockCurrent = WeatherService.getCurrentWeather as jest.Mock;
const mockDaily = WeatherService.getDailyForecast as jest.Mock;
const mockHourly = WeatherService.getHourlyForecast as jest.Mock;
const mockAdjust = FeedingCalculator.computeFeedAdjustment as jest.Mock;
const mockPlan = FeedingCalculator.generateFeedingPlan as jest.Mock;

describe('GrowoutDashboardService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return empty dashboard when no profile/cultivation', async () => {
    mockProfile.mockResolvedValue(null);
    mockCultivation.mockResolvedValue(null);
    mockPlan.mockReturnValue([]);

    const result = await GrowoutDashboardService.getDashboard('u1');

    expect(result.hasData).toBe(false);
    expect(result.group).toBe('MARKET');
  });

  it('should return populated dashboard when data exists', async () => {
    mockProfile.mockResolvedValue({ farmLatitude: 13.7, farmLongitude: 100.5 });
    mockCultivation.mockResolvedValue({ id: 'ct-1' });
    mockGetCycle.mockResolvedValue({ id: 'cycle-1' });

    mockFindMany
      .mockResolvedValueOnce([{ recordedAt: new Date('2026-03-01T00:00:00Z'), averageFishWeightGr: 500 }])
      .mockResolvedValueOnce([
        { recordedAt: new Date('2026-03-20T00:00:00Z'), fishAgeLabel: '120 วัน', fishAgeDays: 120, harvestStatus: 'OPTIMAL', harvestStatusReason: 'ok', averageFishWeightGr: 520, fishAgeStage: { displayName: 'ปลาตลาด' } },
        { recordedAt: new Date('2026-03-19T00:00:00Z'), fishAgeLabel: '119 วัน', fishAgeDays: 119, harvestStatus: 'OPTIMAL', harvestStatusReason: 'ok', averageFishWeightGr: 500, fishAgeStage: { displayName: 'ปลาตลาด' } },
      ])
      .mockResolvedValueOnce([{ recordedAt: new Date('2026-03-01T00:00:00Z'), fishReleased: 100, fishRemaining: 90 }]);

    mockCurrent.mockResolvedValue({ temperatureC: 30 });
    mockDaily.mockResolvedValue([{ temperatureMeanC: 30, temperatureMaxC: 32, temperatureMinC: 28, weatherCode: 1, conditionText: 'clear' }]);
    mockHourly.mockResolvedValue([{ time: '2026-03-20T01:00:00Z', temperatureC: 30 }]);
    mockAdjust.mockReturnValue({ adjustmentPct: -5, recommendation: 'decrease' });
    mockPlan.mockReturnValue([{ date: '2026-03-20T00:00:00Z', meanTemperatureC: 30, highTemperatureC: 32, lowTemperatureC: 28, feedAdjustmentPct: 0, feedingRecommendation: 'normal' }]);

    const result = await GrowoutDashboardService.getDashboard('u1', 'pond-1');

    expect(result.hasData).toBe(true);
    expect(result.summary.averageFishWeight).toBe(520);
    expect(result.summary.monthlyFeedingData).toHaveLength(1);
  });

  it('should skip weather fetch when coordinates are missing', async () => {
    mockProfile.mockResolvedValue({ farmLatitude: null, farmLongitude: null });
    mockCultivation.mockResolvedValue({ id: 'ct-1' });
    mockGetCycle.mockResolvedValue(null);

    mockFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    mockPlan.mockReturnValue([]);

    const result = await GrowoutDashboardService.getDashboard('u1');

    expect(mockCurrent).not.toHaveBeenCalled();
    expect(result.summary.weather).toBeNull();
    expect(result.summary.averageFishWeight).toBeNull();
  });

  it('should return null survival rate when total released is zero', async () => {
    mockProfile.mockResolvedValue({ farmLatitude: null, farmLongitude: null });
    mockCultivation.mockResolvedValue({ id: 'ct-1' });
    mockGetCycle.mockResolvedValue(null);

    mockFindMany
      .mockResolvedValueOnce([{ recordedAt: new Date('2026-03-01T00:00:00Z'), averageFishWeightGr: null }])
      .mockResolvedValueOnce([
        { recordedAt: new Date('2026-03-20T00:00:00Z'), fishAgeLabel: null, fishAgeDays: null, harvestStatus: null, harvestStatusReason: null, averageFishWeightGr: null, fishAgeStage: null },
      ])
      .mockResolvedValueOnce([
        { recordedAt: new Date('2026-03-01T00:00:00Z'), fishReleased: 0, fishRemaining: null },
      ]);

    mockPlan.mockReturnValue([]);

    const result = await GrowoutDashboardService.getDashboard('u1');

    expect(result.summary.totalReleased).toBe(0);
    expect(result.summary.survivalRatePct).toBeNull();
    expect(result.summary.survivalSeries).toEqual([]);
  });
});
