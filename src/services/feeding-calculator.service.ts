import { FarmType } from '@prisma/client';

type TemperatureRange = {
  minComfortC: number;
  maxComfortC: number;
};

export type FeedingPlanRow = {
  date: string;
  meanTemperatureC: number | null;
  highTemperatureC: number | null;
  lowTemperatureC: number | null;
  weatherCode?: number;
  conditionText?: string;
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
 * Calculate feed adjustment based on DAILY MEAN AIR TEMPERATURE
 * 
 * AGE-SPECIFIC ADJUSTMENTS:
 * Different fish age groups have different temperature sensitivity:
 * 
 * 1. SMALL (Fingerling / Pla Tum 7-10 days): Most sensitive nursery window
 *    - Narrow optimal range: 28-34°C air (water 23-29°C)
 *    - Q10 = 2.8-3.2 (metabolism changes rapidly)
 *    - Critical temp: <26°C or >35°C → high mortality risk
 *    - Immune system immature, stress easily
 * 
 * 2. LARGE (Pla Nio juvenile 11-30 days): Juvenile tolerance
 *    - Wider optimal range: 27-35°C air (water 22-30°C)
 *    - Q10 = 2.3-2.6 (moderate metabolism changes)
 *    - Developing immune system, better stress tolerance
 * 
 * 3. MARKET (31-180 days / 2-6 months): Most tolerant grow-out stage
 *    - Widest optimal range: 26-36°C air (water 21-31°C)
 *    - Q10 = 2.0-2.2 (metabolism changes slowly)
 *    - Mature immune system, high stress tolerance
 *    - Can survive brief cold/hot extremes
 * 
 * CRITICAL: This function uses AIR temperature but thresholds are adjusted based on
 * water temperature research. Air temp is typically 5-7°C higher than water temp in
 * tropical pond conditions (Thailand).
 * 
 * Air-Water Temperature Relationship:
 * - Air temp = Water temp + 5-7°C (typical in tropical ponds)
 * - Depends on: pond depth, sun exposure, wind, time of day
 * - Water has high thermal mass → changes slowly, more stable
 * 
 * Feeding Practice Context:
 * - Farmers feed 2x/day: morning (6-8 AM) and evening (4-6 PM)
 * - Feeding times occur at moderate temperatures (not daily max/min)
 * - Mean temperature best represents daily pond conditions
 * - FCR (Feed Conversion Ratio) correlates with daily mean temperature
 * 
 * Research References:
 * - Tucker & Hargreaves (2004): "Biology and Culture of Channel Catfish"
 * - Boyd & Tucker (1998): "Pond Aquaculture Water Quality Management"
 * - Thailand DOF (2018): "แนวทางการเลี้ยงปลาดุกแอฟริกัน"
 * - Buentello et al. (2000): Temperature effects on catfish feed intake
 * - Air-water temp correlation: Losordo & Piedrahita (1991)
 */
const computeFeedAdjustment = (
  temperatureC: number | null,
  range: TemperatureRange,
  farmType: FarmType = FarmType.SMALL, // Default to most sensitive
): { adjustmentPct: number; recommendation: 'increase' | 'decrease' | 'normal' } => {
  if (temperatureC === null) {
    return { adjustmentPct: 0, recommendation: 'normal' };
  }

  let adjustmentPct = 0;
  let recommendation: 'increase' | 'decrease' | 'normal' = 'normal';

  // Age-specific optimal temperature ranges (air temperature)
  const optimalRanges: Record<FarmType, { min: number; max: number }> = {
    [FarmType.SMALL]: { min: 28, max: 34 },  // 7-10 days: narrow range, most sensitive
    [FarmType.LARGE]: { min: 27, max: 35 },  // 11-30 days: juvenile range
    [FarmType.MARKET]: { min: 26, max: 36 }, // 31-180 days (~2-6 months): most tolerant
  };

  const optimal = optimalRanges[farmType];

  // OPTIMAL ZONE: Age-specific optimal range
  if (temperatureC >= optimal.min && temperatureC <= optimal.max) {
    adjustmentPct = 0;
    recommendation = 'normal';
  }
  // COLD ZONE: Below optimal range
  // Water temp drops, metabolism slows, reduce feeding
  else if (temperatureC < optimal.min) {
    // Age-specific cold sensitivity multipliers
    const coldMultiplier = {
      [FarmType.SMALL]: 1.3,  // Most sensitive - reduce more aggressively
      [FarmType.LARGE]: 1.0,  // Standard reduction
      [FarmType.MARKET]: 0.7, // Most tolerant - reduce less
    }[farmType];

    if (temperatureC < 18) {
      // Extreme cold: <18°C air → ~11-13°C water
      adjustmentPct = Math.round(-80 * coldMultiplier);
      recommendation = 'decrease';
    } else if (temperatureC < 21) {
      // Very cold: 18-21°C air → ~13-16°C water
      adjustmentPct = Math.round(-60 * coldMultiplier);
      recommendation = 'decrease';
    } else if (temperatureC < 24) {
      // Cold: 21-24°C air → ~16-19°C water
      adjustmentPct = Math.round(-40 * coldMultiplier);
      recommendation = 'decrease';
    } else if (temperatureC < 26) {
      // Cool: 24-26°C air → ~19-21°C water
      const delta = 26 - temperatureC;
      adjustmentPct = Math.round(-(40 + delta * 5) * coldMultiplier);
      recommendation = 'decrease';
    } else {
      // Mild cool: approaching optimal range
      const delta = optimal.min - temperatureC;
      adjustmentPct = Math.round(-delta * 3 * coldMultiplier);
      recommendation = 'decrease';
    }
  }
  // HOT ZONE: Above optimal range
  // Water temp rises, stress increases, DO drops, reduce feeding
  else if (temperatureC > optimal.max) {
    // Age-specific heat sensitivity multipliers
    const heatMultiplier = {
      [FarmType.SMALL]: 1.4,  // Most sensitive - reduce more aggressively
      [FarmType.LARGE]: 1.0,  // Standard reduction
      [FarmType.MARKET]: 0.8, // Most tolerant - reduce less
    }[farmType];

    if (temperatureC >= 41) {
      // Critical heat: >41°C air → >36°C water
      adjustmentPct = Math.round(-85 * heatMultiplier);
      recommendation = 'decrease';
    } else if (temperatureC >= 39) {
      // Severe stress: 39-41°C air → ~34-36°C water
      adjustmentPct = Math.round(-60 * heatMultiplier);
      recommendation = 'decrease';
    } else if (temperatureC >= 37) {
      // Moderate stress: 37-39°C air → ~32-34°C water
      adjustmentPct = Math.round(-30 * heatMultiplier);
      recommendation = 'decrease';
    } else {
      // Entering stress: just above optimal
      const delta = temperatureC - optimal.max;
      adjustmentPct = Math.round(-delta * 6 * heatMultiplier);
      recommendation = 'decrease';
    }
  }

  // Safety bounds: never reduce more than 90% or increase
  adjustmentPct = Math.max(-90, Math.min(0, adjustmentPct));

  return { adjustmentPct, recommendation };
};

const generateMockForecast = (
  startDate: Date,
  baseTemperatureC: number | null,
  range: TemperatureRange,
  days: number,
  farmType: FarmType,
): FeedingPlanRow[] => {
  const midpoint = (range.minComfortC + range.maxComfortC) / 2;
  const baseTemp = baseTemperatureC ?? midpoint;

  return Array.from({ length: days }, (_, index) => {
    const variance = Math.sin(index * 0.5) * 1.5;
    const mean = clampToOneDecimal(baseTemp + variance);
    const high = clampToOneDecimal(mean + 3);
    const low = clampToOneDecimal(mean - 3);
    const { adjustmentPct, recommendation } = computeFeedAdjustment(mean, range, farmType);

    return {
      date: formatDateISO(addDays(startDate, index)),
      meanTemperatureC: mean,
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
  farmType: FarmType = FarmType.SMALL,
): FeedingPlanRow[] => {
  return generateMockForecast(startDate, currentTemperatureC, range, days, farmType);
};

export const FeedingCalculator = {
  computeFeedAdjustment,
  generateFeedingPlan,
};
