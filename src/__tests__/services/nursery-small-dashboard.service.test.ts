jest.mock('../../clients/prisma', () => ({
  prisma: {
    farmerProfile: { findUnique: jest.fn() },
    farmerCultivationType: { findFirst: jest.fn() },
    farmDataEntry: { findFirst: jest.fn(), findMany: jest.fn() },
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

import { NurserySmallDashboardService } from '../../services/nursery-small-dashboard.service';
import { prisma } from '../../clients/prisma';
import { PondService } from '../../services/pond.service';
import { WeatherService } from '../../services/weather.service';
import { FeedingCalculator } from '../../services/feeding-calculator.service';

const mockProfile = prisma.farmerProfile.findUnique as jest.Mock;
const mockCultivation = prisma.farmerCultivationType.findFirst as jest.Mock;
const mockEntryFindFirst = prisma.farmDataEntry.findFirst as jest.Mock;
const mockEntryFindMany = prisma.farmDataEntry.findMany as jest.Mock;
const mockGetCycle = PondService.getActiveCycle as jest.Mock;
const mockCurrent = WeatherService.getCurrentWeather as jest.Mock;
const mockDaily = WeatherService.getDailyForecast as jest.Mock;
const mockHourly = WeatherService.getHourlyForecast as jest.Mock;
const mockAdjust = FeedingCalculator.computeFeedAdjustment as jest.Mock;
const mockPlan = FeedingCalculator.generateFeedingPlan as jest.Mock;

describe('NurserySmallDashboardService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return empty dashboard when no profile/cultivation', async () => {
    mockProfile.mockResolvedValue(null);
    mockCultivation.mockResolvedValue(null);
    mockPlan.mockReturnValue([]);

    const result = await NurserySmallDashboardService.getDashboard('u1');

    expect(result.hasData).toBe(false);
    expect(result.group).toBe('SMALL');
  });

  it('should return populated dashboard when data exists', async () => {
    mockProfile.mockResolvedValue({ farmLatitude: 13.7, farmLongitude: 100.5 });
    mockCultivation.mockResolvedValue({ id: 'ct-1' });
    mockGetCycle.mockResolvedValue({ id: 'cycle-1' });

    mockEntryFindFirst.mockResolvedValue({
      fishAgeLabel: '30-45 วัน',
      fishAgeDays: 40,
      averageFishWeightGr: 50,
      fishAgeStage: { displayName: 'ปลาตุ้ม' },
    });

    mockEntryFindMany.mockResolvedValue([
      { recordedAt: new Date('2026-03-01T00:00:00Z'), fishReleased: 100, fishRemaining: 90 },
    ]);

    mockCurrent.mockResolvedValue({ temperatureC: 30 });
    mockDaily.mockResolvedValue([{ temperatureMeanC: 30, temperatureMaxC: 32, temperatureMinC: 28, weatherCode: 1, conditionText: 'clear' }]);
    mockHourly.mockResolvedValue([{ time: '2026-03-20T01:00:00Z', temperatureC: 30 }]);

    mockAdjust.mockReturnValue({ adjustmentPct: -5, recommendation: 'decrease' });
    mockPlan.mockReturnValue([{ date: '2026-03-20T00:00:00Z', meanTemperatureC: 30, highTemperatureC: 32, lowTemperatureC: 28, feedAdjustmentPct: 0, feedingRecommendation: 'normal' }]);

    const result = await NurserySmallDashboardService.getDashboard('u1', 'pond-1');

    expect(result.hasData).toBe(true);
    expect(result.summary.airTemperatureC).toBe(30);
    expect(result.feedingPlan).toHaveLength(1);
  });

  it('should handle weather fetch failure and keep null weather summary', async () => {
    mockProfile.mockResolvedValue({ farmLatitude: 13.7, farmLongitude: 100.5 });
    mockCultivation.mockResolvedValue({ id: 'ct-1' });
    mockGetCycle.mockResolvedValue(null);

    mockEntryFindFirst.mockResolvedValue(null);
    mockEntryFindMany.mockResolvedValue([]);

    mockCurrent.mockRejectedValue(new Error('weather unavailable'));
    mockDaily.mockResolvedValue([]);
    mockHourly.mockResolvedValue([]);
    mockPlan.mockReturnValue([]);

    const result = await NurserySmallDashboardService.getDashboard('u1');

    expect(result.summary.weather).toBeNull();
    expect(result.summary.airTemperatureC).toBeNull();
    expect(result.summary.temperatureDeltaC).toBeNull();
    expect(result.summary.recommendedFeedAdjustmentPct).toBe(0);
  });

  it('should fallback currentCount to totalReleased when no remaining record exists', async () => {
    mockProfile.mockResolvedValue({ farmLatitude: null, farmLongitude: null });
    mockCultivation.mockResolvedValue({ id: 'ct-1' });
    mockGetCycle.mockResolvedValue(null);

    mockEntryFindFirst.mockResolvedValue({
      fishAgeLabel: '30 วัน',
      fishAgeDays: 30,
      averageFishWeightGr: null,
      fishAgeStage: null,
    });

    mockEntryFindMany.mockResolvedValue([
      { recordedAt: new Date('2026-03-01T00:00:00Z'), fishReleased: 100, fishRemaining: null },
      { recordedAt: new Date('2026-03-02T00:00:00Z'), fishReleased: 100, fishRemaining: null },
    ]);

    mockPlan.mockReturnValue([{ date: '2026-03-20T00:00:00Z' }]);

    const result = await NurserySmallDashboardService.getDashboard('u1');

    expect(result.summary.currentCount).toBe(100);
    expect(result.summary.survivalRatePct).toBe(100);
    expect(result.summary.survivalSeries).toHaveLength(2);
  });
});
