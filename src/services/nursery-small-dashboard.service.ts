import { FarmType } from '@prisma/client';
import { prisma } from '../clients/prisma';
import { WeatherService, type CurrentWeather, type DailyForecast, type HourlyForecast } from './weather.service';
import { FeedingCalculator, type FeedingPlanRow } from './feeding-calculator.service';
import { logger } from '../utils/logger';

// Optimal temperature range for catfish (consistent across all stages)
const COMFORT_TEMP_RANGE = { min: 28, max: 32 };
const TEMP_RANGE_FOR_CALC = { minComfortC: 28, maxComfortC: 32 };

type TemperatureRange = {
  min: number;
  max: number;
};

type DashboardSummary = {
  asOf: string;
  airTemperatureC: number | null;
  temperatureDeltaC: number | null;
  comfortRangeC: TemperatureRange;
  recommendedFeedAdjustmentPct: number;
  weather: CurrentWeather | null;
  hourlyForecast: HourlyForecast[];
  latestFishAgeLabel: string | null;
  latestFishAgeDays: number | null;
  survivalRatePct: number;
  survivalSeries: Array<{ month: string; value: number }>;
};

export type NurserySmallDashboard = {
  group: FarmType;
  hasData: boolean;
  summary: DashboardSummary;
  feedingPlan: FeedingPlanRow[];
};



const pickFarmWithLocation = (
  farms: Array<{ id: string; latitude: number | null; longitude: number | null }>,
) =>
  farms.find(
    (f) =>
      f.latitude !== null &&
      f.latitude !== undefined &&
      f.longitude !== null &&
      f.longitude !== undefined,
  );

const fetchWeather = async (
  farms: Array<{ id: string; latitude: number | null; longitude: number | null }>,
): Promise<CurrentWeather | null> => {
  const farm = pickFarmWithLocation(farms);
  if (!farm) return null;

  try {
    return await WeatherService.getCurrentWeather(
      farm.latitude as number,
      farm.longitude as number,
    );
  } catch (error) {
    logger.warn('Unable to fetch weather for nursery small dashboard', {
      farmId: farm.id,
      error,
    });
    return null;
  }
};

const getLatestFishAge = async (
  userId: string,
): Promise<{ latestFishAgeLabel: string | null; latestFishAgeDays: number | null }> => {
  const entry = await prisma.farmDataEntry.findFirst({
    where: {
      userId,
      farmType: FarmType.SMALL,
    },
    select: {
      fishAgeLabel: true,
      fishAgeDays: true,
      recordedAt: true,
    },
    orderBy: {
      recordedAt: 'desc',
    },
  });

  // Calculate projected age if we have a valid record date and age
  const latestFishAgeLabel = entry?.fishAgeLabel ?? null;
  const recordedAgeDays = entry?.fishAgeDays ?? null;

  // Use recorded age directly. Frontend will handle real-time projection.
  const projectedAgeDays = recordedAgeDays;

  return {
    latestFishAgeLabel,
    latestFishAgeDays: projectedAgeDays,
  };
};

const formatGraphLabel = (date: Date): string =>
  date.toLocaleDateString('th-TH', {
    day: '2-digit',
    month: 'short',
  });

const getSurvivalSeries = async (
  userId: string,
): Promise<{ survivalRatePct: number; survivalSeries: Array<{ month: string; value: number }> }> => {
  const entries = await prisma.farmDataEntry.findMany({
    where: {
      userId,
      farmType: FarmType.SMALL,
    },
    select: {
      recordedAt: true,
      fishCount: true,
      fishCountText: true,
    },
    orderBy: {
      recordedAt: 'asc',
    },
  });

  const normalized = entries
    .map((entry) => {
      const numeric = Number(entry.fishCount);
      if (Number.isFinite(numeric)) {
        return { recordedAt: entry.recordedAt, fishCount: numeric };
      }

      const digits = entry.fishCountText?.replace(/[^0-9]/g, '') ?? '';
      const parsed = digits ? Number(digits) : NaN;
      if (Number.isFinite(parsed)) {
        return { recordedAt: entry.recordedAt, fishCount: parsed };
      }

      return null;
    })
    .filter((entry): entry is { recordedAt: Date; fishCount: number } => Boolean(entry));

  if (!normalized.length) {
    return { survivalRatePct: 100, survivalSeries: [] };
  }

  const initialCount = Number(normalized[0]?.fishCount ?? NaN);
  if (!Number.isFinite(initialCount) || initialCount <= 0) {
    return { survivalRatePct: 100, survivalSeries: [] };
  }

  const series = normalized.map((entry) => {
    const current = Number(entry.fishCount);
    const pct = Number.isFinite(current) && current >= 0
      ? Math.max(0, Math.min(100, Math.round((current / initialCount) * 100)))
      : 0;
    return {
      month: formatGraphLabel(entry.recordedAt),
      value: pct,
    };
  });

  const survivalRatePct = series.length ? series[series.length - 1]?.value ?? 100 : 100;
  return { survivalRatePct, survivalSeries: series };
};

const getDashboard = async (userId: string): Promise<NurserySmallDashboard> => {
  const [farmerProfile, cultivationType] = await Promise.all([
    prisma.farmerProfile.findUnique({
      where: { userId },
      select: {
        farmLatitude: true,
        farmLongitude: true,
      },
    }),
    prisma.farmerCultivationType.findFirst({
      where: {
        userId,
        farmType: FarmType.SMALL,
      },
      select: { id: true },
    }),
  ]);

  // Check if this user is a farmer with fingerling ponds
  if (!farmerProfile || !cultivationType) {
    return {
      group: FarmType.SMALL,
      hasData: false,
      summary: {
        asOf: new Date().toISOString(),
        airTemperatureC: null,
        temperatureDeltaC: null,
        comfortRangeC: COMFORT_TEMP_RANGE,
        recommendedFeedAdjustmentPct: 0,
        weather: null,
        hourlyForecast: [],
        latestFishAgeLabel: null,
        latestFishAgeDays: null,
        survivalRatePct: 100,
        survivalSeries: [],
      },
      feedingPlan: FeedingCalculator.generateFeedingPlan(
        new Date(),
        null,
        TEMP_RANGE_FOR_CALC,
        7,
        FarmType.SMALL,
      ),
    };
  }

  // Fetch weather using farmer profile location
  let weather: CurrentWeather | null = null;
  let dailyForecast: DailyForecast[] = [];
  let hourlyForecast: HourlyForecast[] = [];

  if (farmerProfile.farmLatitude !== null && farmerProfile.farmLongitude !== null) {
    try {
      [weather, dailyForecast, hourlyForecast] = await Promise.all([
        WeatherService.getCurrentWeather(
          farmerProfile.farmLatitude,
          farmerProfile.farmLongitude,
        ),
        WeatherService.getDailyForecast(
          farmerProfile.farmLatitude,
          farmerProfile.farmLongitude,
        ),
        WeatherService.getHourlyForecast(
          farmerProfile.farmLatitude,
          farmerProfile.farmLongitude,
          24,
        ),
      ]);
    } catch (error) {
      logger.warn('Unable to fetch weather data for nursery small dashboard', {
        userId,
        error,
      });
    }
  }
  const airTemperatureC = weather?.temperatureC ?? null;

  let temperatureDeltaC: number | null = null;
  let recommendedFeedAdjustmentPct = 0;

  if (airTemperatureC !== null) {
    // Calculate delta from comfort range
    if (airTemperatureC < COMFORT_TEMP_RANGE.min) {
      temperatureDeltaC = airTemperatureC - COMFORT_TEMP_RANGE.min;
    } else if (airTemperatureC > COMFORT_TEMP_RANGE.max) {
      temperatureDeltaC = airTemperatureC - COMFORT_TEMP_RANGE.max;
    } else {
      temperatureDeltaC = 0;
    }

    // Use the same logic as feeding plan calculation
    const { adjustmentPct } = FeedingCalculator.computeFeedAdjustment(
      airTemperatureC,
      TEMP_RANGE_FOR_CALC,
      FarmType.SMALL,
    );
    recommendedFeedAdjustmentPct = adjustmentPct;
  }

  const asOf = new Date().toISOString();

  const baseFeedingPlan = FeedingCalculator.generateFeedingPlan(
    new Date(asOf),
    airTemperatureC,
    TEMP_RANGE_FOR_CALC,
    dailyForecast.length || 7,
    FarmType.SMALL,
  );

  const feedingPlan: FeedingPlanRow[] = baseFeedingPlan.map((row, index) => {
    const forecast = dailyForecast[index];
    if (!forecast) {
      return row;
    }

    const { adjustmentPct, recommendation } = FeedingCalculator.computeFeedAdjustment(
      forecast.temperatureMeanC,
      TEMP_RANGE_FOR_CALC,
      FarmType.SMALL,
    );

    return {
      ...row,
      meanTemperatureC: forecast.temperatureMeanC,
      highTemperatureC: forecast.temperatureMaxC,
      lowTemperatureC: forecast.temperatureMinC,
      weatherCode: forecast.weatherCode,
      conditionText: forecast.conditionText,
      feedAdjustmentPct: adjustmentPct,
      feedingRecommendation: recommendation,
    };
  });

  const { latestFishAgeLabel, latestFishAgeDays } = await getLatestFishAge(userId);
  const { survivalRatePct, survivalSeries } = await getSurvivalSeries(userId);

  return {
    group: FarmType.SMALL,
    hasData: survivalSeries.length > 0,
    summary: {
      asOf,
      airTemperatureC,
      temperatureDeltaC,
      comfortRangeC: COMFORT_TEMP_RANGE,
      recommendedFeedAdjustmentPct,
      weather,
      hourlyForecast,
      latestFishAgeLabel,
      latestFishAgeDays,
      survivalRatePct,
      survivalSeries,
    },
    feedingPlan,
  };
};

export const NurserySmallDashboardService = {
  getDashboard,
};
