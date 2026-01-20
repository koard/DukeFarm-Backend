import { prisma } from '../clients/prisma';
import { FarmType, Prisma, RegistrationStatus } from '@prisma/client';
import { createHttpError } from '../utils/httpError';
import { decimalToNumber } from '../utils/number';

type FarmerListItem = {
  userId: string;
  no: number;
  fullName: string;
  phone: string;
  farmType: FarmType;
  farmTypes: FarmType[];
  registrationStatus: RegistrationStatus;
  pondCount: number | null;
  latitude: number | null;
  longitude: number | null;
  farmAreaRai: number | null;
  pondsPerRai: number | null;
  registeredAt: string;
};

type PaginationParams = {
  page: number;
  limit: number;
};

type FarmerListResponse = {
  data: FarmerListItem[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
};

const getFarmerList = async (params: PaginationParams): Promise<FarmerListResponse> => {
  const { page, limit } = params;
  const skip = (page - 1) * limit;

  // Get farmers with FARMER role and COMPLETED registration
  const [farmers, totalCount] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: 'FARMER',
        registrationStatus: 'COMPLETED',
      },
      include: {
        farmerProfile: true,
        cultivationTypes: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    }),
    prisma.user.count({
      where: {
        role: 'FARMER',
        registrationStatus: 'COMPLETED',
      },
    }),
  ]);

  const data: FarmerListItem[] = farmers.map((farmer, index) => ({
    userId: farmer.id,
    no: skip + index + 1,
    fullName: farmer.farmerProfile
      ? `${farmer.farmerProfile.firstName} ${farmer.farmerProfile.lastName}`
      : farmer.displayName || 'N/A',
    phone: farmer.farmerProfile?.phone || '-',
    farmType:
      farmer.farmerProfile?.primaryFarmType ||
      farmer.cultivationTypes[0]?.farmType ||
      FarmType.SMALL,
    farmTypes: farmer.cultivationTypes.map((item) => item.farmType),
    registrationStatus: farmer.registrationStatus,
    pondCount: farmer.farmerProfile?.declaredPondCount || null,
    latitude: farmer.farmerProfile?.farmLatitude || null,
    longitude: farmer.farmerProfile?.farmLongitude || null,
    farmAreaRai: decimalToNumber(farmer.farmerProfile?.farmAreaRai),
    pondsPerRai: decimalToNumber(farmer.farmerProfile?.pondsPerRai),
    registeredAt: farmer.createdAt.toISOString(),
  }));

  const totalPages = Math.ceil(totalCount / limit);

  return {
    data,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems: totalCount,
      itemsPerPage: limit,
    },
  };
};


type FarmerDetailStats = {
  averageFishWeight: number | null; // will be null for now
  survivalRate: number | null;
  survivalRatePct: number | null; // For compatibility
  latestFishAgeDays: number | null;
  latestFishAgeLabel: string | null;
  latestFishCount: number | null;
  totalPonds: number | null;
};

type FarmerDetailEntry = {
  id: string;
  recordedAt: string;
  farmType: FarmType;
  fishAgeDays: number | null;
  fishAgeLabel: string | null;
  pondType: string | null;
  pondCount: number | null;
  fishCount: number | null;
  fishCountText: string | null;
  foodAmountKg: number | null;
  weatherTemperatureC: number | null;
  weatherRainMm: number | null;
  weatherHumidityPct: number | null;
  fishAverageWeight: number | null; // null for now
};

type FarmerDetailResponse = FarmerListItem & {
  stats: FarmerDetailStats;
  entries: FarmerDetailEntry[];
  availableFarmTypes: FarmType[];
};

const getFarmerById = async (
  userId: string,
  farmTypeQuery?: FarmType | 'ALL',
): Promise<FarmerDetailResponse> => {
  const farmer = await prisma.user.findFirst({
    where: {
      id: userId,
      role: 'FARMER',
      registrationStatus: 'COMPLETED',
    },
    include: {
      farmerProfile: true,
      cultivationTypes: true,
    },
  });

  if (!farmer) {
    throw createHttpError(404, 'Farmer not found');
  }

  // Determine filtering
  // If 'ALL', we validly explicitly want everything.
  // If specific, we filter by it.
  // If undefined, we fallback to default logic (primary type).

  let filterFarmType: FarmType | undefined;

  if (farmTypeQuery === 'ALL') {
    filterFarmType = undefined; // No filter
  } else if (farmTypeQuery) {
    filterFarmType = farmTypeQuery;
  } else {
    // Default: แสดงทั้งหมด (ALL) เมื่อไม่ได้ระบุ farmType
    filterFarmType = undefined;
  }

  // Fetch historical records
  const whereClause: Prisma.FarmDataEntryWhereInput = { userId };
  if (filterFarmType) {
    whereClause.farmType = filterFarmType;
  }

  const entries = await prisma.farmDataEntry.findMany({
    where: whereClause,
    orderBy: {
      recordedAt: 'desc',
    },
  });

  // Calculate Survival Rate
  // Logic: (Latest Valid Count / Initial Count) * 100
  // Note: If ALL is selected, this stat might be messy if mixing pond types/groups. 
  // We'll calculate it based on the *very first* record vs *very last* record found in the set, strictly by time.

  const sortedAsc = [...entries].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());

  let survivalRatePct = 100;

  // Find initial count (first valid numeric count)
  const initialEntry = sortedAsc.find(e => e.fishCount !== null && e.fishCount > 0);
  const latestEntry = [...sortedAsc].reverse().find(e => e.fishCount !== null && e.fishCount >= 0);

  if (initialEntry && latestEntry && initialEntry.fishCount) {
    const start = initialEntry.fishCount;
    const current = latestEntry.fishCount!;
    survivalRatePct = Math.max(0, Math.min(100, Math.round((current / start) * 100)));
  }

  // Stats
  // For 'ALL', we just show the latest record's data for context, or maybe we should return nulls?
  // Let's stick to "Latest Record" regardless of it switching types.
  const latestRecord = entries[0];

  const stats: FarmerDetailStats = {
    averageFishWeight: null,
    survivalRate: survivalRatePct,
    survivalRatePct: survivalRatePct,
    latestFishAgeDays: latestRecord?.fishAgeDays ?? null,
    latestFishAgeLabel: latestRecord?.fishAgeLabel ?? null,
    latestFishCount: latestEntry?.fishCount ?? null,
    totalPonds: farmer.farmerProfile?.declaredPondCount ?? null,
  };

  // Farmer Base Info
  const baseInfo: FarmerListItem = {
    userId: farmer.id,
    no: 1,
    fullName: farmer.farmerProfile
      ? `${farmer.farmerProfile.firstName} ${farmer.farmerProfile.lastName}`
      : farmer.displayName || 'N/A',
    phone: farmer.farmerProfile?.phone || '-',
    farmType: filterFarmType || farmer.farmerProfile?.primaryFarmType || FarmType.SMALL, // Just show something representative
    farmTypes: farmer.cultivationTypes.map((item) => item.farmType),
    registrationStatus: farmer.registrationStatus,
    pondCount: farmer.farmerProfile?.declaredPondCount || null,
    latitude: farmer.farmerProfile?.farmLatitude || null,
    longitude: farmer.farmerProfile?.farmLongitude || null,
    farmAreaRai: decimalToNumber(farmer.farmerProfile?.farmAreaRai),
    pondsPerRai: decimalToNumber(farmer.farmerProfile?.pondsPerRai),
    registeredAt: farmer.createdAt.toISOString(),
  };

  return {
    ...baseInfo,
    stats,
    entries: entries.map((e) => ({
      id: e.id,
      recordedAt: e.recordedAt.toISOString(),
      farmType: e.farmType,
      fishAgeDays: e.fishAgeDays,
      fishAgeLabel: e.fishAgeLabel,
      pondType: e.pondType ? e.pondType.toString() : null,
      pondCount: e.pondCount,
      fishCount: e.fishCount,
      fishCountText: e.fishCountText,
      foodAmountKg: e.foodAmountKg,
      weatherTemperatureC: e.weatherTemperatureC,
      weatherRainMm: e.weatherRainMm,
      weatherHumidityPct: e.weatherHumidityPct,
      fishAverageWeight: null,
    })),
    availableFarmTypes: farmer.cultivationTypes.map((t) => t.farmType),
  };
};

const deleteFarmerById = async (userId: string) => {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      throw createHttpError(404, 'Farmer not found');
    }

    if (user.role !== 'FARMER') {
      throw createHttpError(400, 'Only farmer accounts can be deleted via this endpoint');
    }

    const farms = await tx.farm.findMany({
      where: { ownerId: userId },
      select: {
        id: true,
      },
    });

    const farmIds = farms.map((farm) => farm.id);
    const productionCycleIds: string[] = []; // Cannot trace cycles without Pond link

    if (productionCycleIds.length > 0) {
      await tx.researchSurvey.deleteMany({ where: { productionCycleId: { in: productionCycleIds } } });
      await tx.dailyRecord.deleteMany({ where: { productionCycleId: { in: productionCycleIds } } });
      await tx.productionCycle.deleteMany({ where: { id: { in: productionCycleIds } } });
    }



    const feedFormulaConditions: Prisma.FeedFormulaWhereInput[] = [{ ownerId: userId }];
    if (farmIds.length > 0) {
      feedFormulaConditions.push({ farmId: { in: farmIds } });
    }

    const feedFormulasToDelete = await tx.feedFormula.findMany({
      where: { OR: feedFormulaConditions },
      select: { id: true },
    });

    const feedFormulaIds = feedFormulasToDelete.map((formula) => formula.id);

    if (feedFormulaIds.length > 0) {

      await tx.feedFormula.deleteMany({ where: { id: { in: feedFormulaIds } } });
    }

    if (farmIds.length > 0) {
      await tx.farm.deleteMany({ where: { id: { in: farmIds } } });
    }

    await tx.farmDataEntry.deleteMany({ where: { userId } });
    await tx.farmerCultivationType.deleteMany({ where: { userId } });
    await tx.farmerProfile.deleteMany({ where: { userId } });
    await tx.researcherProfile.deleteMany({ where: { userId } });

    await tx.user.delete({ where: { id: userId } });
  });
};

export const FarmerService = {
  getFarmerList,
  getFarmerById,
  deleteFarmerById,
};
