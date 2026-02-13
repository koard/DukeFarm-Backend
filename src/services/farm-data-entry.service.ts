import { FarmType, PondType, ProductionCycleStatus } from '@prisma/client';
import { prisma } from '../clients/prisma';
import { WeatherService } from './weather.service';
import { logger } from '../utils/logger';
import { FishStageService } from './fish-stage.service';
import { createHttpError } from '../utils/httpError';

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
  latestEntry: {
    recordedAt: Date;
    fishAgeDays: number | null;
    fishRemaining: number | null;
  } | null;
};

export type CreateEntryInput = {
  farmType: FarmType;
  recordedAt: Date;
  cycleStartDate?: Date | null;
  fishAgeLabel: string;
  pondId?: string | null;
  pondType?: PondType | null;
  pondCount?: number | null;
  fishReleased?: number | null;
  fishRemaining?: number | null;
  averageFishWeightGr?: number | null;
  foodAmountKg?: number | null;
  feedFormulaName?: string | null;
  supplementName?: string | null;
  medicineName?: string | null;
  foodCostBaht?: number | null;
  medicineCostBaht?: number | null;
  weather?: {
    temperatureC?: number | null;
    rainMm?: number | null;
    humidityPct?: number | null;
  } | null;
  notes?: string | null;
};

export type UpdateEntryInput = Partial<CreateEntryInput>;

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

  const [weatherSnapshot, latestEntry] = await Promise.all([
    fetchWeatherSnapshot(userId),
    prisma.farmDataEntry.findFirst({
      where: {
        userId,
        farmType,
      },
      orderBy: {
        recordedAt: 'desc',
      },
      select: {
        recordedAt: true,
        fishAgeDays: true,
        fishRemaining: true,
      },
    }),
  ]);

  return {
    currentDateTime: now.toISOString(),
    farmType,
    locationAvailable: weatherSnapshot.locationAvailable,
    weather: weatherSnapshot.weather,
    latestEntry: latestEntry
      ? {
        recordedAt: latestEntry.recordedAt,
        fishAgeDays: latestEntry.fishAgeDays,
        fishRemaining: latestEntry.fishRemaining,
      }
      : null,
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
  // const normalizedFishCountText = input.fishCountText?.trim() || null; // Removed
  // const numericFishCount = input.fishCount ?? parseFishCount(normalizedFishCountText); // Removed

  const [cultivationType, stageAssessment] = await Promise.all([
    ensureCultivationType(userId, input.farmType),
    FishStageService.assessFishStage({
      farmType: input.farmType,
      recordedAt: input.recordedAt,
      fishAgeLabel: normalizedFishAge,
    }),
  ]);

  let productionCycleId: string | null = null;
  if (input.pondId) {
    const activeCycle = await prisma.productionCycle.findFirst({
      where: {
        pondId: input.pondId,
        status: { in: [ProductionCycleStatus.PLANNING, ProductionCycleStatus.STOCKING, ProductionCycleStatus.GROWOUT, ProductionCycleStatus.HARVEST_READY] }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (activeCycle) {
      productionCycleId = activeCycle.id;
    } else {
      // Create new cycle
      const newCycle = await prisma.productionCycle.create({
        data: {
          pondId: input.pondId,
          startDate: input.cycleStartDate ?? input.recordedAt,
          status: ProductionCycleStatus.STOCKING,
          farmType: input.farmType,
          initialStockCount: input.fishReleased ?? 0,
          initialAvgWeightKg: input.averageFishWeightGr ? (input.averageFishWeightGr / 1000) : null,
        }
      });
      productionCycleId = newCycle.id;
    }
  }

  return prisma.farmDataEntry.create({
    data: {
      userId,
      farmType: input.farmType,
      cultivationTypeId: cultivationType?.id ?? null,
      pondId: input.pondId ?? null,
      productionCycleId,
      recordedAt: input.recordedAt,
      fishAgeLabel: normalizedFishAge,
      fishAgeDays: stageAssessment.fishAgeDays,
      fishAgeStageId: stageAssessment.stage?.id ?? null,
      harvestStatus: stageAssessment.harvestStatus,
      harvestStatusReason: stageAssessment.harvestStatusReason,
      pondType: input.pondType ?? null,
      pondCount: applyNumeric(input.pondCount ?? null),
      fishReleased: input.fishReleased ?? null,
      fishRemaining: input.fishRemaining ?? null,
      averageFishWeightGr: input.averageFishWeightGr ?? null,
      foodAmountKg: applyNumeric(input.foodAmountKg),
      feedFormulaName: input.feedFormulaName ?? null,
      supplementName: input.supplementName ?? null,
      medicineName: input.medicineName ?? null,
      foodCostBaht: applyNumeric(input.foodCostBaht),
      medicineCostBaht: applyNumeric(input.medicineCostBaht),
      weatherTemperatureC: applyNumeric(input.weather?.temperatureC ?? null),
      weatherRainMm: applyNumeric(input.weather?.rainMm ?? null),
      weatherHumidityPct: applyNumeric(input.weather?.humidityPct ?? null),
      notes: input.notes ?? null,
    },
  });
};

const updateEntry = async (id: string, input: UpdateEntryInput) => {
  const existing = await prisma.farmDataEntry.findUnique({
    where: { id },
  });

  if (!existing) {
    throw createHttpError(404, 'Record not found');
  }

  const data: any = {};

  if (input.recordedAt) data.recordedAt = input.recordedAt;

  if (input.fishReleased !== undefined) data.fishReleased = applyNumeric(input.fishReleased);
  if (input.fishRemaining !== undefined) data.fishRemaining = applyNumeric(input.fishRemaining);

  if (input.pondType !== undefined) data.pondType = input.pondType ?? null;
  if (input.pondCount !== undefined) data.pondCount = applyNumeric(input.pondCount);
  if (input.foodAmountKg !== undefined) data.foodAmountKg = applyNumeric(input.foodAmountKg);
  if (input.notes !== undefined) data.notes = input.notes;

  if (input.fishAgeLabel) {
    data.fishAgeLabel = input.fishAgeLabel;

    // Use new values if provided, otherwise fallback to existing
    const farmTypeForAssess = input.farmType ?? existing.farmType;
    const recordedAtForAssess = input.recordedAt ?? existing.recordedAt;

    const assessment = await FishStageService.assessFishStage({
      farmType: farmTypeForAssess,
      recordedAt: recordedAtForAssess,
      fishAgeLabel: input.fishAgeLabel,
    });
    data.fishAgeDays = assessment.fishAgeDays;
    data.fishAgeStageId = assessment.stage?.id ?? null;
    data.harvestStatus = assessment.harvestStatus;
    data.harvestStatusReason = assessment.harvestStatusReason;
  }

  if (input.weather) {
    if (input.weather.temperatureC !== undefined) data.weatherTemperatureC = applyNumeric(input.weather.temperatureC);
    if (input.weather.rainMm !== undefined) data.weatherRainMm = applyNumeric(input.weather.rainMm);
    if (input.weather.humidityPct !== undefined) data.weatherHumidityPct = applyNumeric(input.weather.humidityPct);
  }

  return prisma.farmDataEntry.update({
    where: { id },
    data,
  });
};

const deleteEntry = async (id: string) => {
  return prisma.farmDataEntry.delete({
    where: { id },
  });
};

const getUserEntries = async (
  userId: string,
  pondId: string | undefined,
  farmType: FarmType | undefined,
  page: number = 1,
  limit: number = 20,
) => {
  const where: any = { userId };
  if (pondId) {
    where.pondId = pondId;
  }
  if (farmType) {
    where.farmType = farmType;
  }

  const skip = (page - 1) * limit;

  const [entries, totalItems] = await Promise.all([
    prisma.farmDataEntry.findMany({
      where,
      orderBy: { recordedAt: 'desc' },
      skip,
      take: limit,
      include: {
        pond: {
          select: { id: true, pondType: true, farmType: true },
        },
      },
    }),
    prisma.farmDataEntry.count({ where }),
  ]);

  return {
    data: entries.map((e) => ({
      id: e.id,
      farmType: e.farmType,
      pondId: e.pondId,
      pond: e.pond,
      recordedAt: e.recordedAt.toISOString(),
      fishAgeLabel: e.fishAgeLabel,
      fishAgeDays: e.fishAgeDays,
      fishReleased: e.fishReleased,
      fishRemaining: e.fishRemaining,
      foodAmountKg: e.foodAmountKg,
      pondType: e.pondType,
      pondCount: e.pondCount,
      weatherTemperatureC: e.weatherTemperatureC,
      weatherRainMm: e.weatherRainMm,
      weatherHumidityPct: e.weatherHumidityPct,
      notes: e.notes,
      createdAt: e.createdAt.toISOString(),
    })),
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit),
      totalItems,
      itemsPerPage: limit,
    },
  };
};

export const FarmDataEntryService = {
  getFormState,
  createEntry,
  updateEntry,
  deleteEntry,
  getUserEntries,
};
