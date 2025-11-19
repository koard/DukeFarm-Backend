import { prisma } from '../clients/prisma';
import { PondTypeValue } from '../types/pond';

export type CreatePondInput = {
  name: string;
  pondType: PondTypeValue;
  areaM2?: number | null;
  maxDepthM?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
};

export type UpdatePondInput = Partial<CreatePondInput>;

const listByFarmId = (farmId: string) =>
  prisma.pond.findMany({
    where: { farmId },
    orderBy: { createdAt: 'desc' },
  });

const createPond = (farmId: string, data: CreatePondInput) =>
  prisma.pond.create({
    data: {
      farmId,
      ...data,
    },
  });

const updatePond = (id: string, data: UpdatePondInput) =>
  prisma.pond.update({
    where: { id },
    data,
  });

export const PondsService = {
  listByFarmId,
  createPond,
  updatePond,
};
