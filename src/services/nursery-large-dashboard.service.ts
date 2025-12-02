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
  pelletFoodCost: number;
  freshFoodCost: number;
  monthlyFeedingData: MonthlyFeedingData[];
};

export type NurseryLargeDashboard = {
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

const buildGrowthSeries = async (
  userId: string,
): Promise<{ points: MonthlyFeedingData[] }> => {
  const since = new Date(Date.now() - GRAPH_LOOKBACK_DAYS * DAY_IN_MS);

  const entries = await prisma.farmDataEntry.findMany({
    where: {
      userId,
      farmType: FarmType.NURSERY_LARGE,
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

const calculateWeightChangePct = (current: number | null, previous: number | null): number | null => {
  if (current === null || previous === null || previous === 0) {
    return null;
  }

  const diff = current - previous;
  const pct = (diff / previous) * 100;
  return Math.round(pct * 10) / 10;
};

const getLatestFishMetrics = async (
  userId: string,
): Promise<{ averageFishWeight: number | null; weightChange: number | null; latestFishAgeLabel: string | null }> => {
  const recentEntries = await prisma.farmDataEntry.findMany({
    where: {
      userId,
      farmType: FarmType.NURSERY_LARGE,
    },
    select: {
      recordedAt: true,
      fishAgeLabel: true,
      averageFishWeightGr: true,
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
    };
  }

  const latestFishAgeLabel = recentEntries[0]?.fishAgeLabel ?? null;

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

const getDashboard = async (userId: string): Promise<NurseryLargeDashboard> => {
  // Get farmer profile for location data
  const farmerProfile = await prisma.farmerProfile.findUnique({
    where: { userId },
    select: { 
      primaryFarmType: true, 
      farmLatitude: true, 
      farmLongitude: true 
    },
  });

  const { points: monthlyFeedingData } = await buildGrowthSeries(userId);
  
  // Calculate fish weight metrics
  const { averageFishWeight, weightChange, latestFishAgeLabel } = await getLatestFishMetrics(userId);
  
  // Calculate food costs
  const { pelletCost, freshCost } = calculateFoodCosts();

  // Check if this user is a farmer with NURSERY_LARGE farm
  if (!farmerProfile || farmerProfile.primaryFarmType !== FarmType.NURSERY_LARGE) {
    return {
      group: FarmType.NURSERY_LARGE,
      hasData: false,
      summary: {
        asOf: new Date().toISOString(),
        airTemperatureC: null,
        temperatureDeltaC: null,
        comfortRangeC: COMFORT_TEMP_RANGE,
        recommendedFeedAdjustmentPct: 0,
        weather: null,
        hourlyForecast: [],
        averageFishWeight,
        weightChange,
        latestFishAgeLabel,
        pelletFoodCost: pelletCost,
        freshFoodCost: freshCost,
        monthlyFeedingData,
      },
      feedingPlan: FeedingCalculator.generateFeedingPlan(
        new Date(),
        null,
        TEMP_RANGE_FOR_CALC,
        7,
        'NURSERY_LARGE',
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
      logger.warn('Unable to fetch weather data for nursery large dashboard', {
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
    );
    recommendedFeedAdjustmentPct = adjustmentPct;
  }

  const asOf = new Date().toISOString();

  const baseFeedingPlan = FeedingCalculator.generateFeedingPlan(
    new Date(asOf),
    airTemperatureC,
    TEMP_RANGE_FOR_CALC,
    dailyForecast.length || 7,
    'NURSERY_LARGE',
  );

  const feedingPlan: FeedingPlanRow[] = baseFeedingPlan.map((row, index) => {
    const forecast = dailyForecast[index];
    if (!forecast) {
      return row;
    }

    const { adjustmentPct, recommendation } = FeedingCalculator.computeFeedAdjustment(
      forecast.temperatureMeanC,
      TEMP_RANGE_FOR_CALC,
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
    group: FarmType.NURSERY_LARGE,
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
      pelletFoodCost: pelletCost,
      freshFoodCost: freshCost,
      monthlyFeedingData,
    },
    feedingPlan,
  };
};

export const NurseryLargeDashboardService = {
  getDashboard,
};
