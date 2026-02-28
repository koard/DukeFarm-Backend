import { FarmType } from '@prisma/client';
import { prisma } from '../clients/prisma';
import { PondService } from './pond.service';
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
  productionCycleId?: string,
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
  if (productionCycleId) {
    whereClause.productionCycleId = productionCycleId;
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
  productionCycleId?: string,
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
  if (productionCycleId) {
    whereClause.productionCycleId = productionCycleId;
  }

  const entries = await prisma.farmDataEntry.findMany({
    where: whereClause,
    select: {
      recordedAt: true,
      fishReleased: true,
      fishRemaining: true,
    },
    orderBy: {
      recordedAt: 'asc',
    },
  });

  const normalized = entries
    .map((entry) => {
      let released = 0;
      let remaining: number | null = null;

      if (typeof entry.fishReleased === 'number') {
        released = entry.fishReleased;
      }

      if (typeof entry.fishRemaining === 'number') {
        remaining = entry.fishRemaining;
      }

      return { recordedAt: entry.recordedAt, fishReleased: released, fishRemaining: remaining };
    });

  if (!normalized.length) {
    return {
      survivalRatePct: null,
      survivalSeries: [],
      totalReleased: null,
      currentCount: null,
      releaseDate: null
    };
  }

  // fishReleased is the same constant in every record (not additive), so take the first non-zero value
  const totalReleased = normalized.find(e => e.fishReleased > 0)?.fishReleased ?? 0;

  // Current count is the latest non-null remaining count
  // We iterate backwards to find the latest
  let currentCount = 0;
  for (let i = normalized.length - 1; i >= 0; i--) {
    if (normalized[i]?.fishRemaining !== null && normalized[i]?.fishRemaining !== undefined) {
      currentCount = normalized[i]!.fishRemaining!;
      break;
    }
  }

  // If no remaining count found, maybe use totalReleased as fallback? 
  // Or if strictly following "Remaining", it should be 0 or null?
  // Logic: If no record of "remaining", we might assume they are all there?
  // Or better, if never recorded, use totalReleased.
  const hasRemainingRecord = normalized.some(e => e.fishRemaining !== null);
  if (!hasRemainingRecord && totalReleased > 0) {
    currentCount = totalReleased;
  }

  // Calculate survival rate
  let survivalRatePct: number | null = null;
  if (totalReleased > 0) {
    survivalRatePct = Math.round((currentCount / totalReleased) * 100);
  } else {
    // No fish released?
    survivalRatePct = null;
  }

  const releaseDate = normalized[0]?.recordedAt.toISOString() ?? null;



  const survivalSeries: Array<{ month: string; value: number }> = [];

  for (const entry of normalized) {
    // Use the constant totalReleased as denominator (fishReleased is not additive)
    const count = entry.fishRemaining !== null ? entry.fishRemaining : totalReleased;

    if (totalReleased === 0) continue;

    const pct = Math.max(0, Math.min(100, Math.round((count / totalReleased) * 100)));
    survivalSeries.push({
      month: formatGraphLabel(entry.recordedAt),
      value: pct
    });
  }

  return {
    survivalRatePct,
    survivalSeries,
    totalReleased,
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

  // Get active cycle to filter data
  const activeCycle = pondId ? await PondService.getActiveCycle(pondId) : null;
  const activeCycleId = activeCycle?.id;

  const { latestFishAgeLabel, latestFishAgeDays, latestFishStageName, averageFishWeight } = await getLatestFishData(userId, pondId, activeCycleId);
  const { survivalRatePct, survivalSeries, totalReleased, currentCount, releaseDate } = await getSurvivalAndCounts(userId, pondId, activeCycleId);

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
