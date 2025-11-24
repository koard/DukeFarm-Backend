import { FarmType } from '@prisma/client';
import { prisma } from '../clients/prisma';
import { WeatherService, type CurrentWeather } from './weather.service';
import { FeedingCalculator, type FeedingPlanRow } from './feeding-calculator.service';
import { logger } from '../utils/logger';

// Optimal temperature range for catfish (consistent across all stages)
const COMFORT_TEMP_RANGE = { min: 28, max: 32 };
const TEMP_RANGE_FOR_CALC = { minComfortC: 28, maxComfortC: 32 };
const BASE_DAILY_FEED_KG = 5.0;

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

const getDashboard = async (userId: string): Promise<NurserySmallDashboard> => {
  // Get farmer profile for location data
  const farmerProfile = await prisma.farmerProfile.findUnique({
    where: { userId },
    select: { 
      primaryFarmType: true, 
      farmLatitude: true, 
      farmLongitude: true 
    },
  });

  // Check if this user is a farmer with NURSERY_SMALL farm
  if (!farmerProfile || farmerProfile.primaryFarmType !== FarmType.NURSERY_SMALL) {
    return {
      group: FarmType.NURSERY_SMALL,
      hasData: false,
      summary: {
        asOf: new Date().toISOString(),
        airTemperatureC: null,
        temperatureDeltaC: null,
        comfortRangeC: COMFORT_TEMP_RANGE,
        recommendedFeedAdjustmentPct: 0,
        weather: null,
      },
      feedingPlan: FeedingCalculator.generateFeedingPlan(
        new Date(),
        null,
        TEMP_RANGE_FOR_CALC,
        BASE_DAILY_FEED_KG,
      ),
    };
  }

  // Fetch weather using farmer profile location
  let weather: CurrentWeather | null = null;
  if (farmerProfile.farmLatitude !== null && farmerProfile.farmLongitude !== null) {
    try {
      weather = await WeatherService.getCurrentWeather(
        farmerProfile.farmLatitude,
        farmerProfile.farmLongitude,
      );
    } catch (error) {
      logger.warn('Unable to fetch weather for nursery small dashboard', {
        userId,
        error,
      });
    }
  }
  const airTemperatureC = weather?.temperatureC ?? null;

  let temperatureDeltaC: number | null = null;
  let recommendedFeedAdjustmentPct = 0;

  if (airTemperatureC !== null) {
    if (airTemperatureC < COMFORT_TEMP_RANGE.min) {
      temperatureDeltaC = airTemperatureC - COMFORT_TEMP_RANGE.min;
    } else if (airTemperatureC > COMFORT_TEMP_RANGE.max) {
      temperatureDeltaC = airTemperatureC - COMFORT_TEMP_RANGE.max;
    } else {
      temperatureDeltaC = 0;
    }

    if (temperatureDeltaC !== 0) {
      recommendedFeedAdjustmentPct = Math.round(temperatureDeltaC * 0.05 * 100); // 5% per degree
    }
  }

  const asOf = new Date().toISOString();

  return {
    group: FarmType.NURSERY_SMALL,
    hasData: airTemperatureC !== null,
    summary: {
      asOf,
      airTemperatureC,
      temperatureDeltaC,
      comfortRangeC: COMFORT_TEMP_RANGE,
      recommendedFeedAdjustmentPct,
      weather,
    },
    feedingPlan: FeedingCalculator.generateFeedingPlan(
      new Date(asOf),
      airTemperatureC,
      TEMP_RANGE_FOR_CALC,
      BASE_DAILY_FEED_KG,
    ),
  };
};

export const NurserySmallDashboardService = {
  getDashboard,
};
