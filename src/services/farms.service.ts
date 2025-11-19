import { prisma } from '../clients/prisma';
import { FarmTypeValue } from '../types/farm';

type ListFarmsParams = {
  userId: string;
  role: string;
};

type CreateFarmInput = {
  name: string;
  farmType: FarmTypeValue;
  address?: string | null;
  province?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  areaM2?: number | null;
};

type UpdateFarmInput = Partial<CreateFarmInput>;

const listFarms = async ({ userId, role }: ListFarmsParams) => {
  if (role === 'ADMIN') {
    return prisma.farm.findMany({ orderBy: { createdAt: 'desc' } });
  }

  return prisma.farm.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: 'desc' },
  });
};

const createFarm = async (ownerId: string, data: CreateFarmInput) =>
  prisma.farm.create({
    data: {
      ownerId,
      ...data,
    },
  });

const findAccessibleFarm = async (
  id: string,
  userId: string,
  role: string,
): Promise<Awaited<ReturnType<typeof prisma.farm.findUnique>>> => {
  const farm = await prisma.farm.findUnique({ where: { id } });
  if (!farm) {
    return null;
  }

  if (role === 'ADMIN' || farm.ownerId === userId) {
    return farm;
  }

  return null;
};

const getFarmById = async (id: string, userId: string, role: string) =>
  findAccessibleFarm(id, userId, role);

const updateFarm = async (
  id: string,
  ownerId: string,
  role: string,
  data: UpdateFarmInput = {},
) => {
  const existing = await findAccessibleFarm(id, ownerId, role);
  if (!existing) {
    return null;
  }

  return prisma.farm.update({
    where: { id },
    data,
  });
};

export const FarmsService = {
  listFarms,
  createFarm,
  getFarmById,
  updateFarm,
};
