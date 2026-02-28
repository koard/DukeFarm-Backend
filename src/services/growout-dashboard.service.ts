import { FarmType, HarvestReadinessStatus } from '@prisma/client';
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

type MonthlyFeedingData = {
  month: string;
  value: number;
};

type DashboardSummary = {
  asOf: string;
  airTemperatureC: number | null;
  temperatureDeltaC: number | null;
  comfortRangeC: TemperatureRange;
  recommendedFeedAdjustmentPct: number;
  weather: CurrentWeather | null;
  hourlyForecast: HourlyForecast[];
  averageFishWeight: number | null;
  weightChange: number | null;
  latestFishAgeLabel: string | null;
  latestFishAgeDays: number | null;
  latestFishStageName: string | null;
  latestHarvestStatus: HarvestReadinessStatus | null;
  latestHarvestStatusReason: string | null;
  totalReleased: number | null;
  currentCount: number | null;
  releaseDate: string | null;
  pelletFoodCost: number;
  freshFoodCost: number;
  monthlyFeedingData: MonthlyFeedingData[];
  survivalRatePct: number | null;
  survivalSeries: MonthlyFeedingData[];
};

export type GrowoutDashboard = {
  group: FarmType;
  hasData: boolean;
  summary: DashboardSummary;
  feedingPlan: FeedingPlanRow[];
};

const GRAPH_LOOKBACK_DAYS = 30;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const formatGraphLabel = (date: Date): string =>
  date.toLocaleDateString('th-TH', {
    day: '2-digit',
    month: 'short',
  });

const calculateWeightChangePct = (current: number | null, previous: number | null): number | null => {
  if (current === null || previous === null || previous === 0) {
    return null;
  }

  const diff = current - previous;
  const pct = (diff / previous) * 100;
  return Math.round(pct * 10) / 10;
};

const buildGrowthSeries = async (
  userId: string,
  pondId?: string,
  productionCycleId?: string,
): Promise<{ points: MonthlyFeedingData[] }> => {
  const since = new Date(Date.now() - GRAPH_LOOKBACK_DAYS * DAY_IN_MS);

  const whereClause: any = {
    userId,
    farmType: FarmType.MARKET,
    averageFishWeightGr: {
      not: null,
    },
    recordedAt: {
      gte: since,
    },
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
      averageFishWeightGr: true,
    },
    orderBy: {
      recordedAt: 'asc',
    },
  });

  const points: MonthlyFeedingData[] = entries.map((entry) => {
    const grams = entry.averageFishWeightGr ? Number(entry.averageFishWeightGr) : null;
    return {
      month: formatGraphLabel(entry.recordedAt),
      value: grams ? grams / 1000 : 0,
    };
  });

  return { points };
};

type LatestFishMetrics = {
  averageFishWeight: number | null;
  weightChange: number | null;
  latestFishAgeLabel: string | null;
  latestFishAgeDays: number | null;
  latestFishStageName: string | null;
  latestHarvestStatus: HarvestReadinessStatus | null;
  latestHarvestStatusReason: string | null;
};

const getSurvivalAndCounts = async (
  userId: string,
  pondId?: string,
  productionCycleId?: string,
): Promise<{
  survivalRatePct: number | null;
  survivalSeries: MonthlyFeedingData[];
  totalReleased: number | null;
  currentCount: number | null;
  releaseDate: string | null;
}> => {
  const whereClause: any = {
    userId,
    farmType: FarmType.MARKET,
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

  let currentCount = 0;
  for (let i = normalized.length - 1; i >= 0; i--) {
    if (normalized[i]?.fishRemaining !== null && normalized[i]?.fishRemaining !== undefined) {
      currentCount = normalized[i]!.fishRemaining!;
      break;
    }
  }

  const hasRemainingRecord = normalized.some(e => e.fishRemaining !== null);
  if (!hasRemainingRecord && totalReleased > 0) {
    currentCount = totalReleased;
  }

  const releaseDate = normalized[0]?.recordedAt.toISOString() ?? null;

  const improvedSeries: MonthlyFeedingData[] = [];

  for (const entry of normalized) {
    // Use the constant totalReleased as denominator (fishReleased is not additive)
    const count = entry.fishRemaining !== null ? entry.fishRemaining : totalReleased;

    if (totalReleased === 0) continue;

    const pct = Math.max(0, Math.min(100, Math.round((count / totalReleased) * 100)));
    improvedSeries.push({
      month: formatGraphLabel(entry.recordedAt),
      value: pct
    });
  }

  return {
    survivalRatePct: improvedSeries.length > 0 ? improvedSeries[improvedSeries.length - 1]!.value : null,
    survivalSeries: improvedSeries,
    totalReleased,
    currentCount,
    releaseDate
  };
};



const getLatestFishMetrics = async (userId: string, pondId?: string, productionCycleId?: string): Promise<LatestFishMetrics> => {
  const whereClause: any = {
    userId,
    farmType: FarmType.MARKET,
  };
  if (pondId) {
    whereClause.pondId = pondId;
  }
  if (productionCycleId) {
    whereClause.productionCycleId = productionCycleId;
  }

  const recentEntries = await prisma.farmDataEntry.findMany({
    where: whereClause,
    select: {
      recordedAt: true,
      fishAgeLabel: true,
      fishAgeDays: true,
      harvestStatus: true,
      harvestStatusReason: true,
      averageFishWeightGr: true,
      fishAgeStage: {
        select: {
          displayName: true,
        },
      },
    },
    orderBy: {
      recordedAt: 'desc',
    },
    take: 10,
  });

  if (!recentEntries.length) {
    return {
      averageFishWeight: null,
      weightChange: null,
      latestFishAgeLabel: null,
      latestFishAgeDays: null,
      latestFishStageName: null,
      latestHarvestStatus: null,
      latestHarvestStatusReason: null,
    };
  }

  const latestFishAgeLabel = recentEntries[0]?.fishAgeLabel ?? null;
  const latestFishAgeDays = recentEntries[0]?.fishAgeDays ?? null;
  const latestFishStageName = recentEntries[0]?.fishAgeStage?.displayName ?? 'ปลาตลาด';
  const latestHarvestStatus = recentEntries[0]?.harvestStatus ?? null;
  const latestHarvestStatusReason = recentEntries[0]?.harvestStatusReason ?? null;

  const weightEntries = recentEntries.filter((entry) => entry.averageFishWeightGr !== null);
  const latestWeightEntry = weightEntries[0];
  const previousWeightEntry = weightEntries[1];

  const latestWeightGr = latestWeightEntry?.averageFishWeightGr
    ? Number(latestWeightEntry.averageFishWeightGr)
    : null;

  const previousWeightGr = previousWeightEntry?.averageFishWeightGr
    ? Number(previousWeightEntry.averageFishWeightGr)
    : null;

  return {
    averageFishWeight: latestWeightGr,
    weightChange: calculateWeightChangePct(latestWeightGr, previousWeightGr),
    latestFishAgeLabel,
    latestFishAgeDays,
    latestFishStageName,
    latestHarvestStatus,
    latestHarvestStatusReason,
  };
};

/**
 * Calculate food costs (mock data)
 * Can be extended to query actual purchase records
 */
const calculateFoodCosts = (): { pelletCost: number; freshCost: number } => {
  // TODO: Query actual cost records from database
  return {
    pelletCost: 15000, // baht
    freshCost: 8000,   // baht
  };
};

const getDashboard = async (userId: string, pondId?: string): Promise<GrowoutDashboard> => {
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
        farmType: FarmType.MARKET,
      },
      select: { id: true },
    }),
  ]);

  const { pelletCost, freshCost } = calculateFoodCosts();

  if (!farmerProfile || !cultivationType) {
    return {
      group: FarmType.MARKET,
      hasData: false,
      summary: {
        asOf: new Date().toISOString(),
        airTemperatureC: null,
        temperatureDeltaC: null,
        comfortRangeC: COMFORT_TEMP_RANGE,
        recommendedFeedAdjustmentPct: 0,
        weather: null,
        hourlyForecast: [],
        averageFishWeight: null,
        weightChange: null,
        latestFishAgeLabel: null,
        latestFishAgeDays: null,
        latestFishStageName: null,
        latestHarvestStatus: null,
        latestHarvestStatusReason: null,
        totalReleased: null,
        currentCount: null,
        releaseDate: null,
        pelletFoodCost: pelletCost,
        freshFoodCost: freshCost,
        monthlyFeedingData: [],
        survivalRatePct: 100,
        survivalSeries: [],
      },
      feedingPlan: FeedingCalculator.generateFeedingPlan(
        new Date(),
        null,
        TEMP_RANGE_FOR_CALC,
        7,
        FarmType.MARKET,
      ),
    };
  }

  // Get active cycle to filter data
  const activeCycle = pondId ? await PondService.getActiveCycle(pondId) : null;
  const activeCycleId = activeCycle?.id;

  const [
    { points: monthlyFeedingData },
    {
      averageFishWeight,
      weightChange,
      latestFishAgeLabel,
      latestFishAgeDays,
      latestFishStageName,
      latestHarvestStatus,
      latestHarvestStatusReason,
    },
    { survivalRatePct, survivalSeries, totalReleased, currentCount, releaseDate },
  ] = await Promise.all([
    buildGrowthSeries(userId, pondId, activeCycleId),
    getLatestFishMetrics(userId, pondId, activeCycleId),
    getSurvivalAndCounts(userId, pondId, activeCycleId),
  ]);

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
      logger.warn('Unable to fetch weather data for growout dashboard', {
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
      FarmType.MARKET,
    );
    recommendedFeedAdjustmentPct = adjustmentPct;
  }

  const asOf = new Date().toISOString();

  const baseFeedingPlan = FeedingCalculator.generateFeedingPlan(
    new Date(asOf),
    airTemperatureC,
    TEMP_RANGE_FOR_CALC,
    dailyForecast.length || 7,
    FarmType.MARKET,
  );

  const feedingPlan: FeedingPlanRow[] = baseFeedingPlan.map((row, index) => {
    const forecast = dailyForecast[index];
    if (!forecast) {
      return row;
    }

    const { adjustmentPct, recommendation } = FeedingCalculator.computeFeedAdjustment(
      forecast.temperatureMeanC,
      TEMP_RANGE_FOR_CALC,
      FarmType.MARKET,
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

  return {
    group: FarmType.MARKET,
    hasData: survivalSeries.length > 0,
    summary: {
      asOf,
      airTemperatureC,
      temperatureDeltaC,
      comfortRangeC: COMFORT_TEMP_RANGE,
      recommendedFeedAdjustmentPct,
      weather,
      hourlyForecast,
      averageFishWeight,
      weightChange,
      latestFishAgeLabel,
      latestFishAgeDays,
      latestFishStageName,
      latestHarvestStatus,
      latestHarvestStatusReason,
      totalReleased,
      currentCount,
      releaseDate,
      pelletFoodCost: pelletCost,
      freshFoodCost: freshCost,
      monthlyFeedingData,
      survivalRatePct,
      survivalSeries,
    },
    feedingPlan,
  };
};

export const GrowoutDashboardService = {
  getDashboard,
};
