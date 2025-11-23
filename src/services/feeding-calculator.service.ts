type TemperatureRange = {
  minComfortC: number;
  maxComfortC: number;
};

export type FeedingPlanRow = {
  date: string;
  highTemperatureC: number | null;
  lowTemperatureC: number | null;
  recommendedFeedKg: number | null;
};

const clampToOneDecimal = (value: number) => Number(value.toFixed(1));

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const formatDateISO = (date: Date): string => date.toISOString();

const computeFeedAdjustment = (
  baseFeedKg: number,
  temperatureC: number | null,
  range: TemperatureRange,
): number => {
  if (temperatureC === null) {
    return clampToOneDecimal(baseFeedKg);
  }

  let adjustment = 0;

  if (temperatureC < range.minComfortC - 2) {
    adjustment = -0.6;
  } else if (temperatureC < range.minComfortC) {
    adjustment = -0.3;
  } else if (temperatureC > range.maxComfortC + 2) {
    adjustment = -0.5;
  } else if (temperatureC > range.maxComfortC) {
    adjustment = -0.2;
  }

  return clampToOneDecimal(Math.max(baseFeedKg + adjustment, 0));
};

const generateMockForecast = (
  startDate: Date,
  baseTemperatureC: number | null,
  range: TemperatureRange,
  baseFeedKg: number,
  days: number,
): FeedingPlanRow[] => {
  const midpoint = (range.minComfortC + range.maxComfortC) / 2;
  const baseTemp = baseTemperatureC ?? midpoint;

  return Array.from({ length: days }, (_, index) => {
    const variance = Math.sin(index * 0.5) * 1.5;
    const high = clampToOneDecimal(baseTemp + variance);
    const low = clampToOneDecimal(high - 4);
    const feedKg = computeFeedAdjustment(baseFeedKg, high, range);

    return {
      date: formatDateISO(addDays(startDate, index)),
      highTemperatureC: high,
      lowTemperatureC: low,
      recommendedFeedKg: feedKg,
    };
  });
};

const generateFeedingPlan = (
  startDate: Date,
  currentTemperatureC: number | null,
  range: TemperatureRange,
  baseFeedKg: number,
  days: number = 7,
): FeedingPlanRow[] => {
  return generateMockForecast(startDate, currentTemperatureC, range, baseFeedKg, days);
};

export const FeedingCalculator = {
  computeFeedAdjustment,
  generateFeedingPlan,
};
