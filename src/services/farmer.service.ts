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

const getFarmerById = async (userId: string): Promise<FarmerListItem> => {
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

  return {
    userId: farmer.id,
    no: 1,
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
        ponds: {
          select: {
            id: true,
            productionCycles: {
              select: { id: true },
            },
          },
        },
      },
    });

    const farmIds = farms.map((farm) => farm.id);
    const pondIds = farms.flatMap((farm) => farm.ponds.map((pond) => pond.id));
    const productionCycleIds = farms.flatMap((farm) =>
      farm.ponds.flatMap((pond) => pond.productionCycles.map((cycle) => cycle.id)),
    );

    if (productionCycleIds.length > 0) {
      await tx.researchSurvey.deleteMany({ where: { productionCycleId: { in: productionCycleIds } } });
      await tx.treatment.deleteMany({ where: { productionCycleId: { in: productionCycleIds } } });
      await tx.mortality.deleteMany({ where: { productionCycleId: { in: productionCycleIds } } });
      await tx.growthMeasurement.deleteMany({ where: { productionCycleId: { in: productionCycleIds } } });
      await tx.feeding.deleteMany({ where: { productionCycleId: { in: productionCycleIds } } });
      await tx.dailyRecord.deleteMany({ where: { productionCycleId: { in: productionCycleIds } } });
      await tx.productionCycle.deleteMany({ where: { id: { in: productionCycleIds } } });
    }

    if (pondIds.length > 0) {
      await tx.pond.deleteMany({ where: { id: { in: pondIds } } });
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
      await tx.feedFormulaIngredient.deleteMany({ where: { feedFormulaId: { in: feedFormulaIds } } });
      await tx.feedFormula.deleteMany({ where: { id: { in: feedFormulaIds } } });
    }

    if (farmIds.length > 0) {
      await tx.farm.deleteMany({ where: { id: { in: farmIds } } });
    }

    await tx.farmDataEntry.deleteMany({ where: { userId } });
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
