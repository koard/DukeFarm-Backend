import { FarmType, HarvestReadinessStatus } from '@prisma/client';
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
  pelletFoodCost: number;
  freshFoodCost: number;
  monthlyFeedingData: MonthlyFeedingData[];
  survivalRatePct: number | null;
  baselineFishCount: number | null;
  latestFishCount: number | null;
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
): Promise<{ points: MonthlyFeedingData[] }> => {
  const since = new Date(Date.now() - GRAPH_LOOKBACK_DAYS * DAY_IN_MS);

  const entries = await prisma.farmDataEntry.findMany({
    where: {
      userId,
      farmType: FarmType.MARKET,
      averageFishWeightGr: {
        not: null,
      },
      recordedAt: {
        gte: since,
      },
    },
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
  survivalRatePct: number | null;
  baselineFishCount: number | null;
  latestFishCount: number | null;
};

const getSurvivalMetrics = async (
  userId: string,
): Promise<{ survivalRatePct: number | null; baselineFishCount: number | null; latestFishCount: number | null }> => {
  const [baseline, latest] = await Promise.all([
    prisma.farmDataEntry.findFirst({
      where: {
        userId,
        farmType: FarmType.MARKET,
        fishCount: {
          not: null,
        },
      },
      select: {
        fishCount: true,
      },
      orderBy: {
        recordedAt: 'asc',
      },
    }),
    prisma.farmDataEntry.findFirst({
      where: {
        userId,
        farmType: FarmType.MARKET,
        fishCount: {
          not: null,
        },
      },
      select: {
        fishCount: true,
      },
      orderBy: {
        recordedAt: 'desc',
      },
    }),
  ]);

  const baselineFishCount = baseline?.fishCount ? Number(baseline.fishCount) : null;
  const latestFishCount = latest?.fishCount ? Number(latest.fishCount) : null;

  if (baselineFishCount && latestFishCount && baselineFishCount > 0) {
    const rate = (latestFishCount / baselineFishCount) * 100;
    return {
      survivalRatePct: Math.round(rate * 10) / 10,
      baselineFishCount,
      latestFishCount,
    };
  }

  return {
    survivalRatePct: null,
    baselineFishCount,
    latestFishCount,
  };
};

const getLatestFishMetrics = async (userId: string): Promise<LatestFishMetrics> => {
  const recentEntries = await prisma.farmDataEntry.findMany({
    where: {
      userId,
      farmType: FarmType.MARKET,
    },
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
      survivalRatePct: null,
      baselineFishCount: null,
      latestFishCount: null,
    };
  }

  const latestFishAgeLabel = recentEntries[0]?.fishAgeLabel ?? null;
  const latestFishAgeDays = recentEntries[0]?.fishAgeDays ?? null;
  const latestFishStageName = recentEntries[0]?.fishAgeStage?.displayName ?? null;
  const latestHarvestStatus = recentEntries[0]?.harvestStatus ?? null;
  const latestHarvestStatusReason = recentEntries[0]?.harvestStatusReason ?? null;

  const { survivalRatePct, baselineFishCount, latestFishCount } = await getSurvivalMetrics(userId);

  const weightEntries = recentEntries.filter((entry) => entry.averageFishWeightGr !== null);
  const latestWeightEntry = weightEntries[0];
  const previousWeightEntry = weightEntries[1];

  const latestWeightKg = latestWeightEntry?.averageFishWeightGr
    ? Number(latestWeightEntry.averageFishWeightGr) / 1000
    : null;

  const previousWeightKg = previousWeightEntry?.averageFishWeightGr
    ? Number(previousWeightEntry.averageFishWeightGr) / 1000
    : null;

  return {
    averageFishWeight: latestWeightKg,
    weightChange: calculateWeightChangePct(latestWeightKg, previousWeightKg),
    latestFishAgeLabel,
    latestFishAgeDays,
    latestFishStageName,
    latestHarvestStatus,
    latestHarvestStatusReason,
    survivalRatePct,
    baselineFishCount,
    latestFishCount,
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

const getDashboard = async (userId: string): Promise<GrowoutDashboard> => {
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
        pelletFoodCost: pelletCost,
        freshFoodCost: freshCost,
        monthlyFeedingData: [],
        survivalRatePct: null,
        baselineFishCount: null,
        latestFishCount: null,
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
      survivalRatePct,
      baselineFishCount,
      latestFishCount,
    },
  ] = await Promise.all([buildGrowthSeries(userId), getLatestFishMetrics(userId)]);

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
    hasData: monthlyFeedingData.length > 0,
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
      pelletFoodCost: pelletCost,
      freshFoodCost: freshCost,
      monthlyFeedingData,
      survivalRatePct,
      baselineFishCount,
      latestFishCount,
    },
    feedingPlan,
  };
};

export const GrowoutDashboardService = {
  getDashboard,
};
