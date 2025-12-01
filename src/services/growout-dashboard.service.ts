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
  pelletFoodCost: number;
  freshFoodCost: number;
  monthlyFeedingData: MonthlyFeedingData[];
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
): Promise<{ points: MonthlyFeedingData[]; latestWeightKg: number | null; previousWeightKg: number | null }> => {
  const since = new Date(Date.now() - GRAPH_LOOKBACK_DAYS * DAY_IN_MS);

  const entries = await prisma.farmDataEntry.findMany({
    where: {
      userId,
      farmType: FarmType.GROWOUT,
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

  if (entries.length === 0) {
    return { points, latestWeightKg: null, previousWeightKg: null };
  }

  const latest = entries[entries.length - 1]!;
  const previous = entries.length > 1 ? entries[entries.length - 2]! : null;

  return {
    points,
    latestWeightKg: latest.averageFishWeightGr ? Number(latest.averageFishWeightGr) / 1000 : null,
    previousWeightKg: previous && previous.averageFishWeightGr ? Number(previous.averageFishWeightGr) / 1000 : null,
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
  // Get farmer profile for location data
  const farmerProfile = await prisma.farmerProfile.findUnique({
    where: { userId },
    select: { 
      primaryFarmType: true, 
      farmLatitude: true, 
      farmLongitude: true 
    },
  });

  const { points: monthlyFeedingData, latestWeightKg, previousWeightKg } = await buildGrowthSeries(userId);
  const averageFishWeight = latestWeightKg;
  const weightChange = calculateWeightChangePct(latestWeightKg, previousWeightKg);
  
  // Calculate food costs
  const { pelletCost, freshCost } = calculateFoodCosts();

  // Check if this user is a farmer with GROWOUT farm
  if (!farmerProfile || farmerProfile.primaryFarmType !== FarmType.GROWOUT) {
    return {
      group: FarmType.GROWOUT,
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
        pelletFoodCost: pelletCost,
        freshFoodCost: freshCost,
        monthlyFeedingData,
      },
      feedingPlan: FeedingCalculator.generateFeedingPlan(
        new Date(),
        null,
        TEMP_RANGE_FOR_CALC,
        7,
        'GROWOUT',
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
    );
    recommendedFeedAdjustmentPct = adjustmentPct;
  }

  const asOf = new Date().toISOString();

  const baseFeedingPlan = FeedingCalculator.generateFeedingPlan(
    new Date(asOf),
    airTemperatureC,
    TEMP_RANGE_FOR_CALC,
    dailyForecast.length || 7,
    'GROWOUT',
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
    group: FarmType.GROWOUT,
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
      pelletFoodCost: pelletCost,
      freshFoodCost: freshCost,
      monthlyFeedingData,
    },
    feedingPlan,
  };
};

export const GrowoutDashboardService = {
  getDashboard,
};
