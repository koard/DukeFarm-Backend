import { FarmType, PondType } from '@prisma/client';
import { prisma } from '../clients/prisma';
import { WeatherService } from './weather.service';
import { logger } from '../utils/logger';

export type WeatherSnapshot = {
  observedAt: string | null;
  temperatureC: number | null;
  rainMm: number | null;
  humidityPct: number | null;
  conditionText: string | null;
  weatherCode: number | null;
};

export type FormStatePayload = {
  currentDateTime: string;
  farmType: FarmType;
  locationAvailable: boolean;
  weather: WeatherSnapshot | null;
};

export type CreateEntryInput = {
  farmType: FarmType;
  recordedAt: Date;
  fishAgeLabel: string;
  pondType?: PondType | null;
  pondCount?: number | null;
  fishCountText?: string | null;
  weather?: {
    temperatureC?: number | null;
    rainMm?: number | null;
    humidityPct?: number | null;
  } | null;
  notes?: string | null;
};

const AGE_WEIGHT_MAP: Record<string, number> = {
  '0-15วัน': 4,     // fingerling (~4 g)
  '16-30วัน': 15,   // post-larvae (~15 g)
  '31-60วัน': 80,   // early grow-out (~80 g)
  '61-90วัน': 180,  // mid grow-out (~180 g)
  '91-120วัน': 300, // late grow-out (~300 g)
  '>120วัน': 500,   // market size (~500 g)
};

const normalizeAgeLabelKey = (label: string): string =>
  label
    .replace(/[()]/g, '')
    .replace(/–|−/g, '-')
    .replace(/\s+/g, '')
    .toLowerCase();

const resolveAverageWeightForAge = (label: string): number | null => {
  const key = normalizeAgeLabelKey(label);
  return AGE_WEIGHT_MAP[key] ?? null;
};

const fetchWeatherSnapshot = async (
  userId: string,
): Promise<{ weather: WeatherSnapshot | null; locationAvailable: boolean }> => {
  const farmerProfile = await prisma.farmerProfile.findUnique({
    where: { userId },
    select: { farmLatitude: true, farmLongitude: true },
  });

  const hasCoordinates = Boolean(
    farmerProfile &&
      typeof farmerProfile.farmLatitude === 'number' &&
      typeof farmerProfile.farmLongitude === 'number',
  );

  if (!hasCoordinates || farmerProfile === null) {
    return {
      locationAvailable: Boolean(hasCoordinates),
      weather: null,
    };
  }

  try {
    const currentWeather = await WeatherService.getCurrentWeather(
      farmerProfile.farmLatitude!,
      farmerProfile.farmLongitude!,
    );

    return {
      locationAvailable: true,
      weather: {
        observedAt: currentWeather.time ? new Date(currentWeather.time).toISOString() : null,
        temperatureC: currentWeather.temperatureC ?? null,
        rainMm: currentWeather.rainMm ?? null,
        humidityPct: currentWeather.humidityPct ?? null,
        conditionText: currentWeather.conditionText ?? null,
        weatherCode: currentWeather.weatherCode ?? null,
      },
    };
  } catch (error) {
    logger.warn('Unable to fetch weather snapshot for record form', {
      userId,
      error,
    });

    return {
      locationAvailable: true,
      weather: null,
    };
  }
};

const getFormState = async (userId: string, farmType: FarmType): Promise<FormStatePayload> => {
  const now = new Date();
  const { weather, locationAvailable } = await fetchWeatherSnapshot(userId);

  return {
    currentDateTime: now.toISOString(),
    farmType,
    locationAvailable,
    weather,
  };
};

const applyNumeric = (value: number | null | undefined): number | null => {
  if (typeof value !== 'number') {
    return null;
  }

  if (Number.isNaN(value)) {
    return null;
  }

  return value;
};

const parseFishCount = (raw: string | null | undefined): number | null => {
  if (!raw) {
    return null;
  }

  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) {
    return null;
  }

  const parsed = Number(digits);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return parsed;
};

const createEntry = async (userId: string, input: CreateEntryInput) => {
  const normalizedFishAge = input.fishAgeLabel.trim();
  const normalizedFishCountText = input.fishCountText?.trim() || null;
  const numericFishCount = parseFishCount(normalizedFishCountText);
  const averageFishWeightGr = resolveAverageWeightForAge(normalizedFishAge);

  return prisma.farmDataEntry.create({
    data: {
      userId,
      farmType: input.farmType,
      recordedAt: input.recordedAt,
      fishAgeLabel: normalizedFishAge,
      pondType: input.pondType ?? null,
      pondCount: applyNumeric(input.pondCount ?? null),
      fishCount: numericFishCount,
      fishCountText: normalizedFishCountText,
      averageFishWeightGr,
      weatherTemperatureC: applyNumeric(input.weather?.temperatureC ?? null),
      weatherRainMm: applyNumeric(input.weather?.rainMm ?? null),
      weatherHumidityPct: applyNumeric(input.weather?.humidityPct ?? null),
      notes: input.notes ?? null,
    },
  });
};

export const FarmDataEntryService = {
  getFormState,
  createEntry,
};
