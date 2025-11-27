import { prisma } from '../clients/prisma';
import { FarmType, RegistrationStatus } from '@prisma/client';

type FarmerListItem = {
  no: number;
  fullName: string;
  phone: string;
  farmType: FarmType;
  registrationStatus: RegistrationStatus;
  pondCount: number | null;
  latitude: number | null;
  longitude: number | null;
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
    no: skip + index + 1,
    fullName: farmer.farmerProfile
      ? `${farmer.farmerProfile.firstName} ${farmer.farmerProfile.lastName}`
      : farmer.displayName || 'N/A',
    phone: farmer.farmerProfile?.phone || '-',
    farmType: farmer.farmerProfile?.primaryFarmType || 'NURSERY_SMALL',
    registrationStatus: farmer.registrationStatus,
    pondCount: farmer.farmerProfile?.declaredPondCount || null,
    latitude: farmer.farmerProfile?.farmLatitude || null,
    longitude: farmer.farmerProfile?.farmLongitude || null,
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

export const FarmerService = {
  getFarmerList,
};
