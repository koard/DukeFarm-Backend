import { prisma } from '../clients/prisma';
import { FarmType, PondType, Prisma, RegistrationStatus } from '@prisma/client';
import { createHttpError } from '../utils/httpError';
import { decimalToNumber } from '../utils/number';

type PondInfo = {
  id: string;
  pondType: PondType;
  farmType: FarmType;
  widthM: number;
  lengthM: number;
  depthM: number;
  volumeM3: number;
  productionCycleCount: number;
};

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
  ponds?: PondInfo[];
  totalRecords?: number;
  lastRecordDate?: string | null;
};

type PaginationParams = {
  page: number;
  limit: number;
  search?: string;
  farmType?: FarmType;
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
  const { page, limit, search, farmType: filterFarmType } = params;
  const skip = (page - 1) * limit;

  // Build where clause with search and farmType filters
  const whereClause: Prisma.UserWhereInput = {
    role: 'FARMER',
    registrationStatus: 'COMPLETED',
  };

  if (search) {
    whereClause.OR = [
      { farmerProfile: { firstName: { contains: search, mode: 'insensitive' } } },
      { farmerProfile: { lastName: { contains: search, mode: 'insensitive' } } },
      { farmerProfile: { phone: { contains: search } } },
      { displayName: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (filterFarmType) {
    whereClause.cultivationTypes = {
      some: { farmType: filterFarmType },
    };
  }

  // Get farmers with filters
  const [farmers, totalCount] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      include: {
        farmerProfile: {
          include: {
            ponds: true,
          },
        },
        cultivationTypes: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    }),
    prisma.user.count({
      where: whereClause,
    }),
  ]);

  // Get record stats (count + last record date) for all fetched farmers
  const farmerIds = farmers.map((f) => f.id);
  const recordStats = farmerIds.length > 0
    ? await prisma.farmDataEntry.groupBy({
      by: ['userId'],
      where: { userId: { in: farmerIds } },
      _count: { id: true },
      _max: { recordedAt: true },
    })
    : [];
  const recordStatsMap = new Map(recordStats.map((r) => [r.userId, { count: r._count.id, lastDate: r._max.recordedAt }]));

  const data: FarmerListItem[] = farmers.map((farmer, index) => {
    const ponds = farmer.farmerProfile?.ponds || [];
    const stats = recordStatsMap.get(farmer.id);

    return {
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
      pondCount: ponds.length || farmer.farmerProfile?.declaredPondCount || null,
      latitude: farmer.farmerProfile?.farmLatitude || null,
      longitude: farmer.farmerProfile?.farmLongitude || null,
      farmAreaRai: decimalToNumber(farmer.farmerProfile?.farmAreaRai),
      pondsPerRai: decimalToNumber(farmer.farmerProfile?.pondsPerRai),
      registeredAt: farmer.createdAt.toISOString(),
      totalRecords: stats?.count ?? 0,
      lastRecordDate: stats?.lastDate?.toISOString() ?? null,
    };
  });

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
  averageFishWeight: number | null;
  survivalRate: number | null;
  survivalRatePct: number | null;
  latestFishAgeDays: number | null;
  latestFishAgeLabel: string | null;
  latestFishCount: number | null;
  totalPonds: number | null;
};

type DashboardSummary = {
  fishType: string;
  avgWeight: number | null;
  releaseCount: number | null;
  remainingCount: number | null;
  survivalRate: number | null;
};

type FarmerDetailEntry = {
  id: string;
  recordedAt: string;
  farmType: FarmType;
  fishAgeDays: number | null;
  fishAgeLabel: string | null;
  pondType: string | null;
  pondCount: number | null;
  fishRemaining: number | null;
  fishReleased: number | null;
  foodAmountKg: number | null;
  averageFishWeightGr: number | null;
  feedFormulaName: string | null;
  medicineName: string | null;
  weatherTemperatureC: number | null;
  weatherRainMm: number | null;
  weatherHumidityPct: number | null;
  fishAverageWeight: number | null;
};

type FarmerDetailResponse = FarmerListItem & {
  stats: FarmerDetailStats;
  dashboardSummary: DashboardSummary;
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
      farmerProfile: {
        include: {
          ponds: true,
        },
      },
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

  // Find initial count (prefer fishReleased, then max remaining)
  const initialEntry = sortedAsc.find(e => (e.fishReleased !== null && e.fishReleased > 0) || (e.fishRemaining !== null && e.fishRemaining > 0));
  const latestEntry = [...sortedAsc].reverse().find(e => e.fishRemaining !== null && e.fishRemaining >= 0);

  if (initialEntry && latestEntry && latestEntry.fishRemaining !== null) {
    const start = initialEntry.fishReleased || initialEntry.fishRemaining || 0;
    const current = latestEntry.fishRemaining;
    if (start > 0) {
      survivalRatePct = Math.max(0, Math.min(100, Math.round((current / start) * 100)));
    }
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
    latestFishCount: latestRecord?.fishRemaining ?? null,
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

  // Calculate dashboard summary
  const FARM_TYPE_LABELS: Record<string, string> = {
    SMALL: 'ปลาตุ้ม',
    LARGE: 'ปลานิ้ว',
    MARKET: 'ปลาตลาด',
  };

  const activeFarmType = filterFarmType || farmer.farmerProfile?.primaryFarmType || FarmType.SMALL;
  const fishType = FARM_TYPE_LABELS[activeFarmType] || activeFarmType;

  // Avg weight from latest entry
  const latestWithWeight = entries.find(e => e.averageFishWeightGr !== null);
  const avgWeight = latestWithWeight?.averageFishWeightGr
    ? Number(latestWithWeight.averageFishWeightGr)
    : null;

  // Release count from first entry, remaining from latest
  const firstEntry = sortedAsc.find(e => (e.fishReleased !== null && e.fishReleased > 0));
  const releaseCount = firstEntry?.fishReleased ?? null;
  const remainingCount = latestEntry?.fishRemaining ?? null;

  const dashboardSummary: DashboardSummary = {
    fishType,
    avgWeight,
    releaseCount,
    remainingCount,
    survivalRate: entries.length > 0 ? survivalRatePct : null,
  };

  // Map ponds with production cycle count
  const pondIds = (farmer.farmerProfile?.ponds || []).map((p) => p.id);
  const cycleCounts = pondIds.length > 0
    ? await prisma.productionCycle.groupBy({
      by: ['pondId'],
      where: { pondId: { in: pondIds } },
      _count: { id: true },
    })
    : [];
  const cycleCountMap = new Map(cycleCounts.map((c) => [c.pondId, c._count.id]));

  const ponds: PondInfo[] = (farmer.farmerProfile?.ponds || []).map((p) => ({
    id: p.id,
    pondType: p.pondType,
    farmType: p.farmType,
    widthM: Number(p.widthM),
    lengthM: Number(p.lengthM),
    depthM: Number(p.depthM),
    volumeM3: Number(p.volumeM3),
    productionCycleCount: cycleCountMap.get(p.id) || 0,
  }));

  return {
    ...baseInfo,
    ponds,
    stats,
    dashboardSummary,
    entries: entries.map((e) => ({
      id: e.id,
      recordedAt: e.recordedAt.toISOString(),
      farmType: e.farmType,
      fishAgeDays: e.fishAgeDays,
      fishAgeLabel: e.fishAgeLabel,
      pondType: e.pondType ? e.pondType.toString() : null,
      pondCount: e.pondCount,
      fishRemaining: e.fishRemaining,
      fishReleased: e.fishReleased,
      foodAmountKg: e.foodAmountKg,
      averageFishWeightGr: e.averageFishWeightGr ? Number(e.averageFishWeightGr) : null,
      feedFormulaName: e.feedFormulaName,
      medicineName: e.medicineName,
      weatherTemperatureC: e.weatherTemperatureC,
      weatherRainMm: e.weatherRainMm,
      weatherHumidityPct: e.weatherHumidityPct,
      fishAverageWeight: e.averageFishWeightGr ? Number(e.averageFishWeightGr) : null,
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
