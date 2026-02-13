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
  latestFishStageName: string | null;
  averageFishWeight: number | null;
  totalReleased: number | null; // Initial count
  currentCount: number | null;  // Latest count
  releaseDate: string | null;   // Date of first record
  survivalRatePct: number | null;
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

const getLatestFishData = async (
  userId: string,
  pondId?: string,
): Promise<{
  latestFishAgeLabel: string | null;
  latestFishAgeDays: number | null;
  latestFishStageName: string | null;
  averageFishWeight: number | null;
}> => {
  const whereClause: any = {
    userId,
    farmType: FarmType.SMALL,
  };
  if (pondId) {
    whereClause.pondId = pondId;
  }

  const entry = await prisma.farmDataEntry.findFirst({
    where: whereClause,
    select: {
      fishAgeLabel: true,
      fishAgeDays: true,
      recordedAt: true,
      averageFishWeightGr: true,
      fishAgeStage: {
        select: { displayName: true }
      }
    },
    orderBy: {
      recordedAt: 'desc',
    },
  });

  // Use recorded age directly. Frontend will handle real-time projection.
  const projectedAgeDays = entry?.fishAgeDays ?? null;

  return {
    latestFishAgeLabel: entry?.fishAgeLabel ?? null,
    latestFishAgeDays: projectedAgeDays,
    latestFishStageName: entry?.fishAgeStage?.displayName ?? 'ปลาตุ้ม',
    averageFishWeight: entry?.averageFishWeightGr ? Number(entry.averageFishWeightGr) : null,
  };
};

const formatGraphLabel = (date: Date): string =>
  date.toLocaleDateString('th-TH', {
    day: '2-digit',
    month: 'short',
  });

const getSurvivalAndCounts = async (
  userId: string,
  pondId?: string,
): Promise<{
  survivalRatePct: number | null;
  survivalSeries: Array<{ month: string; value: number }>;
  totalReleased: number | null;
  currentCount: number | null;
  releaseDate: string | null;
}> => {
  const whereClause: any = {
    userId,
    farmType: FarmType.SMALL,
  };
  if (pondId) {
    whereClause.pondId = pondId;
  }

  const entries = await prisma.farmDataEntry.findMany({
    where: whereClause,
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
    return {
      survivalRatePct: null,
      survivalSeries: [],
      totalReleased: null,
      currentCount: null,
      releaseDate: null
    };
  }

  const initialCount = Number(normalized[0]?.fishCount ?? NaN);
  const currentCount = Number(normalized[normalized.length - 1]?.fishCount ?? NaN);
  const releaseDate = normalized[0]?.recordedAt.toISOString() ?? null;

  if (!Number.isFinite(initialCount) || initialCount <= 0) {
    return {
      survivalRatePct: null,
      survivalSeries: [],
      totalReleased: initialCount > 0 ? initialCount : null,
      currentCount: Number.isFinite(currentCount) ? currentCount : null,
      releaseDate
    };
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

  const survivalRatePct = series.length ? series[series.length - 1]?.value ?? null : null;
  return {
    survivalRatePct,
    survivalSeries: series,
    totalReleased: initialCount,
    currentCount,
    releaseDate
  };
};

const getDashboard = async (userId: string, pondId?: string): Promise<NurserySmallDashboard> => {
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
        latestFishStageName: null,
        averageFishWeight: null,
        totalReleased: null,
        currentCount: null,
        releaseDate: null,
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

  const { latestFishAgeLabel, latestFishAgeDays, latestFishStageName, averageFishWeight } = await getLatestFishData(userId, pondId);
  const { survivalRatePct, survivalSeries, totalReleased, currentCount, releaseDate } = await getSurvivalAndCounts(userId, pondId);

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
      latestFishStageName,
      averageFishWeight,
      totalReleased,
      currentCount,
      releaseDate,
      survivalRatePct,
      survivalSeries,
    },
    feedingPlan,
  };
};

export const NurserySmallDashboardService = {
  getDashboard,
};
