type TemperatureRange = {
  minComfortC: number;
  maxComfortC: number;
};

export type FeedingPlanRow = {
  date: string;
  highTemperatureC: number | null;
  lowTemperatureC: number | null;
  feedAdjustmentPct: number;
  feedingRecommendation: 'increase' | 'decrease' | 'normal';
};

const clampToOneDecimal = (value: number) => Number(value.toFixed(1));

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const formatDateISO = (date: Date): string => date.toISOString();

/**
 * Calculate feed adjustment based on AIR TEMPERATURE
 * 
 * IMPORTANT: This uses air temperature (from weather API), not water temperature.
 * Air temp is typically 3-8°C higher than water temp depending on:
 * - Pond depth
 * - Sun exposure
 * - Wind speed
 * - Time of day
 * 
 * Research basis:
 * - Thailand DOF catfish farming guidelines
 * - Practical farmer experience in tropical conditions
 * - Adjusted for air temperature correlation with water conditions
 * 
 * Air Temperature Zones (adjusted for air-water difference):
 * - Below 24°C air: Cold weather, reduce feed 15-25%
 * - 24-28°C air: Cool weather, reduce feed 5-10%
 * - 28-35°C air: Optimal air temp (water likely 25-30°C)
 * - 35-38°C air: Hot weather, reduce feed 10-15%
 * - 38-40°C air: Very hot, reduce feed 20-30%
 * - Above 40°C air: Extreme heat, reduce feed 40-50%
 * 
 * Note: Does NOT reach -100% (stop feeding) based on air temp alone,
 * as water temp is usually cooler and more stable.
 */
const computeFeedAdjustment = (
  temperatureC: number | null,
  range: TemperatureRange,
): { adjustmentPct: number; recommendation: 'increase' | 'decrease' | 'normal' } => {
  if (temperatureC === null) {
    return { adjustmentPct: 0, recommendation: 'normal' };
  }

  let adjustmentPct = 0;
  let recommendation: 'increase' | 'decrease' | 'normal' = 'normal';

  // Within optimal air temperature range (28-35°C)
  // Water likely 25-30°C which is good for catfish
  if (temperatureC >= 28 && temperatureC <= 35) {
    adjustmentPct = 0;
    recommendation = 'normal';
  }
  // Cool/cold air temperature (below 28°C)
  else if (temperatureC < 28) {
    if (temperatureC < 20) {
      // Very cold air: water likely below 18°C
      adjustmentPct = -30;
      recommendation = 'decrease';
    } else if (temperatureC < 24) {
      // Cold air: water likely 20-22°C
      adjustmentPct = -20;
      recommendation = 'decrease';
    } else {
      // Cool air (24-28°C): water likely 22-25°C
      const delta = 28 - temperatureC;
      adjustmentPct = -Math.round(delta * 2.5); // ~2.5% per degree
      recommendation = 'decrease';
    }
  }
  // Hot air temperature (above 35°C)
  else if (temperatureC > 35) {
    if (temperatureC >= 42) {
      // Extreme heat: water likely 36-38°C - very dangerous
      adjustmentPct = -50;
      recommendation = 'decrease';
    } else if (temperatureC >= 40) {
      // Very hot air: water likely 34-36°C - critical
      adjustmentPct = -30;
      recommendation = 'decrease';
    } else if (temperatureC >= 38) {
      // Hot air: water likely 32-34°C - stressful
      adjustmentPct = -20;
      recommendation = 'decrease';
    } else {
      // Warm air (35-38°C): water likely 30-32°C - upper comfort limit
      const delta = temperatureC - 35;
      adjustmentPct = -Math.round(delta * 3); // ~3% per degree
      recommendation = 'decrease';
    }
  }

  return { adjustmentPct, recommendation };
};

const generateMockForecast = (
  startDate: Date,
  baseTemperatureC: number | null,
  range: TemperatureRange,
  days: number,
): FeedingPlanRow[] => {
  const midpoint = (range.minComfortC + range.maxComfortC) / 2;
  const baseTemp = baseTemperatureC ?? midpoint;

  return Array.from({ length: days }, (_, index) => {
    const variance = Math.sin(index * 0.5) * 1.5;
    const high = clampToOneDecimal(baseTemp + variance);
    const low = clampToOneDecimal(high - 4);
    const { adjustmentPct, recommendation } = computeFeedAdjustment(high, range);

    return {
      date: formatDateISO(addDays(startDate, index)),
      highTemperatureC: high,
      lowTemperatureC: low,
      feedAdjustmentPct: adjustmentPct,
      feedingRecommendation: recommendation,
    };
  });
};

const generateFeedingPlan = (
  startDate: Date,
  currentTemperatureC: number | null,
  range: TemperatureRange,
  days: number = 7,
): FeedingPlanRow[] => {
  return generateMockForecast(startDate, currentTemperatureC, range, days);
};

export const FeedingCalculator = {
  computeFeedAdjustment,
  generateFeedingPlan,
};
