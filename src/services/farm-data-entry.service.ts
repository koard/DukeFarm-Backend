import { FarmType, PondType } from '@prisma/client';
import { prisma } from '../clients/prisma';
import { WeatherService } from './weather.service';
import { logger } from '../utils/logger';
import { FishStageService } from './fish-stage.service';

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

const resolveAverageWeightForAge = (label: string): number | null => {
  const days = FishStageService.estimateDaysFromLabel(label);
  if (days === null) {
    return null;
  }

  if (days <= 10) {
    return 4; // Pla Tum ~4 g
  }

  if (days <= 30) {
    return 15; // Pla Nio ~15 g
  }

  if (days <= 60) {
    return 80; // Early grow-out ~80 g
  }

  if (days <= 120) {
    return 250; // Mid grow-out ~250 g
  }

  if (days <= 180) {
    return 450; // Late grow-out ~450 g
  }

  return 500; // Extended holding ~500 g
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

const ensureCultivationType = async (userId: string, farmType: FarmType) =>
  prisma.farmerCultivationType.upsert({
    where: {
      farmer_cultivation_type_user_stage_unique: {
        userId,
        farmType,
      },
    },
    update: {},
    create: {
      userId,
      farmType,
    },
    select: {
      id: true,
    },
  });

const createEntry = async (userId: string, input: CreateEntryInput) => {
  const normalizedFishAge = input.fishAgeLabel.trim();
  const normalizedFishCountText = input.fishCountText?.trim() || null;
  const numericFishCount = parseFishCount(normalizedFishCountText);
  const averageFishWeightGr = resolveAverageWeightForAge(normalizedFishAge);

  const [cultivationType, stageAssessment] = await Promise.all([
    ensureCultivationType(userId, input.farmType),
    FishStageService.assessFishStage({
      farmType: input.farmType,
      recordedAt: input.recordedAt,
      fishAgeLabel: normalizedFishAge,
    }),
  ]);

  return prisma.farmDataEntry.create({
    data: {
      userId,
      farmType: input.farmType,
      cultivationTypeId: cultivationType?.id ?? null,
      recordedAt: input.recordedAt,
      fishAgeLabel: normalizedFishAge,
      fishAgeDays: stageAssessment.fishAgeDays,
      fishAgeStageId: stageAssessment.stage?.id ?? null,
      harvestStatus: stageAssessment.harvestStatus,
      harvestStatusReason: stageAssessment.harvestStatusReason,
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
