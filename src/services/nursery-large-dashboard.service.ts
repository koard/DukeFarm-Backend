import { FarmType } from '@prisma/client';
import { prisma } from '../clients/prisma';
import { WeatherService, type CurrentWeather, type DailyForecast, type HourlyForecast, type LocationInfo } from './weather.service';
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
  location: LocationInfo | null;
  averageFishWeight: number;
  weightChange: number;
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

/**
 * Generate mock monthly feeding data for the past 12 months
 * Values are in kilograms (Kg) and show typical feeding patterns
 */
const generateMonthlyFeedingData = (): MonthlyFeedingData[] => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentMonth = new Date().getMonth();
  
  // Base values with seasonal variation
  const baseValues = [0.25, 0.5, 0.65, 0.95, 0.8, 2.0, 1.2, 1.4, 1.6, 1.8, 1.5, 1.3];
  
  // Rotate array to start from current month going back
  const rotatedMonths: MonthlyFeedingData[] = [];
  for (let i = 0; i < 12; i++) {
    const monthIndex = (currentMonth - 11 + i + 12) % 12;
    rotatedMonths.push({
      month: months[monthIndex]!,
      value: baseValues[monthIndex]!,
    });
  }
  
  return rotatedMonths;
};

/**
 * Calculate average fish weight based on farm records
 * For now returns mock data, can be extended to query actual pond records
 */
const calculateAverageFishWeight = async (userId: string): Promise<{ weight: number; change: number }> => {
  // TODO: Query actual pond records when available
  // const ponds = await prisma.pond.findMany({
  //   where: { farm: { farmerProfile: { userId } } },
  //   include: { latestMeasurement: true }
  // });
  
  // Mock data for demonstration
  const currentWeight = 0.3; // kg
  const previousWeight = 0.306; // kg (2% higher)
  const change = ((currentWeight - previousWeight) / previousWeight) * 100;
  
  return {
    weight: currentWeight,
    change: Math.round(change * 10) / 10, // Round to 1 decimal
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

  // Generate monthly feeding data
  const monthlyFeedingData = generateMonthlyFeedingData();
  
  // Calculate fish weight metrics
  const { weight: averageFishWeight, change: weightChange } = await calculateAverageFishWeight(userId);
  
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
        location: null,
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
        'NURSERY_LARGE',
      ),
    };
  }

  // Fetch weather using farmer profile location
  let weather: CurrentWeather | null = null;
  let dailyForecast: DailyForecast[] = [];
  let hourlyForecast: HourlyForecast[] = [];
  let location: LocationInfo | null = null;

  if (farmerProfile.farmLatitude !== null && farmerProfile.farmLongitude !== null) {
    try {
      [weather, dailyForecast, hourlyForecast, location] = await Promise.all([
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
        WeatherService.getLocationName(
          farmerProfile.farmLatitude,
          farmerProfile.farmLongitude,
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
    hasData: airTemperatureC !== null,
    summary: {
      asOf,
      airTemperatureC,
      temperatureDeltaC,
      comfortRangeC: COMFORT_TEMP_RANGE,
      recommendedFeedAdjustmentPct,
      weather,
      hourlyForecast,
      location,
      averageFishWeight,
      weightChange,
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
