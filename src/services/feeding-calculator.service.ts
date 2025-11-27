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
 * Temperature Zones (Air temp → Estimated water temp → Feeding adjustment):
 * 
 * COLD ZONE (tuned for Pathum Thani climate):
 * - <18°C air → ~11-13°C water → -80% (extreme cold, rare: 1-2 days/year)
 * - 18-21°C air → ~13-16°C water → -60% (very cold, coldest mornings Dec-Jan)
 * - 21-24°C air → ~16-19°C water → -40% (cold, occasional in Nov-Feb)
 * - 24-26°C air → ~19-21°C water → -40% to -50% (cool, common in Nov-Feb)
 * - 26-28°C air → ~21-23°C water → -3% per degree (mild, very common mornings)
 * 
 * OPTIMAL ZONE:
 * - 28-35°C air → ~23-30°C water → 0% (OPTIMAL - normal feeding) ✅
 *   Research shows catfish optimal water temp: 26-30°C
 *   Converted to air: 31-35°C (adding ~5°C)
 * 
 * HOT ZONE:
 * - 35-37°C air → ~30-32°C water → -6% per degree (entering stress)
 * - 37-39°C air → ~32-34°C water → -30% (moderate stress, reduced DO)
 * - 39-41°C air → ~34-36°C water → -60% (severe stress, low DO)
 * - >41°C air → >36°C water → -85% (critical, survival mode)
 * 
 * Biological Basis:
 * - Q10 rule: Metabolic rate changes exponentially with temperature
 * - Cold: Metabolism slows → reduced digestion → must reduce feeding
 * - Hot: Dissolved oxygen drops → stress → must reduce feeding
 * - Optimal: Maximum feed conversion efficiency
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
): { adjustmentPct: number; recommendation: 'increase' | 'decrease' | 'normal' } => {
  if (temperatureC === null) {
    return { adjustmentPct: 0, recommendation: 'normal' };
  }

  let adjustmentPct = 0;
  let recommendation: 'increase' | 'decrease' | 'normal' = 'normal';

  // OPTIMAL ZONE: 28-35°C air (water ~23-30°C)
  // This is where catfish feed efficiently
  if (temperatureC >= 28 && temperatureC <= 35) {
    adjustmentPct = 0;
    recommendation = 'normal';
  }
  // COLD ZONE: Below 28°C air
  // Water temp drops, metabolism slows, reduce feeding
  else if (temperatureC < 28) {
    if (temperatureC < 18) {
      // Extreme cold: <18°C air → ~11-13°C water
      // Very rare in Pathum Thani (1-2 days/year)
      // Catfish barely feed, high FCR, risk of disease
      adjustmentPct = -80;
      recommendation = 'decrease';
    } else if (temperatureC < 21) {
      // Very cold: 18-21°C air → ~13-16°C water
      // Rare in Pathum Thani (coldest mornings Dec-Jan)
      // Significant metabolism reduction
      adjustmentPct = -60;
      recommendation = 'decrease';
    } else if (temperatureC < 24) {
      // Cold: 21-24°C air → ~16-19°C water
      // Occasional in cool season (Nov-Feb mornings)
      // Feed intake notably reduced
      adjustmentPct = -40;
      recommendation = 'decrease';
    } else if (temperatureC < 26) {
      // Cool: 24-26°C air → ~19-21°C water
      // Common in cool season (Nov-Feb)
      // Moderate reduction, 5% per degree
      const delta = 26 - temperatureC;
      adjustmentPct = -Math.round(40 + delta * 5);
      recommendation = 'decrease';
    } else {
      // Mild cool: 26-28°C air → ~21-23°C water
      // Very common in Pathum Thani mornings (Nov-Feb)
      // Catfish still feed well, gentle reduction
      const delta = 28 - temperatureC;
      adjustmentPct = -Math.round(delta * 3); // 3% per degree (was 4%)
      recommendation = 'decrease';
    }
  }
  // HOT ZONE: Above 35°C air
  // Water temp rises, stress increases, DO drops, reduce feeding
  else if (temperatureC > 35) {
    if (temperatureC >= 41) {
      // Critical heat: >41°C air → >36°C water
      // Near-lethal conditions, minimal feeding to avoid mortality
      adjustmentPct = -85;
      recommendation = 'decrease';
    } else if (temperatureC >= 39) {
      // Severe stress: 39-41°C air → ~34-36°C water
      // High stress, very low DO, significant reduction
      adjustmentPct = -60;
      recommendation = 'decrease';
    } else if (temperatureC >= 37) {
      // Moderate stress: 37-39°C air → ~32-34°C water
      // DO starts dropping, stress increases
      adjustmentPct = -30;
      recommendation = 'decrease';
    } else {
      // Entering stress: 35-37°C air → ~30-32°C water
      // Upper optimal limit, gradual reduction
      const delta = temperatureC - 35;
      adjustmentPct = -Math.round(delta * 6); // 6% per degree
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
): FeedingPlanRow[] => {
  const midpoint = (range.minComfortC + range.maxComfortC) / 2;
  const baseTemp = baseTemperatureC ?? midpoint;

  return Array.from({ length: days }, (_, index) => {
    const variance = Math.sin(index * 0.5) * 1.5;
    const mean = clampToOneDecimal(baseTemp + variance);
    const high = clampToOneDecimal(mean + 3);
    const low = clampToOneDecimal(mean - 3);
    const { adjustmentPct, recommendation } = computeFeedAdjustment(mean, range);

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
): FeedingPlanRow[] => {
  return generateMockForecast(startDate, currentTemperatureC, range, days);
};

export const FeedingCalculator = {
  computeFeedAdjustment,
  generateFeedingPlan,
};
