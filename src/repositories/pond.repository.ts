import { prisma } from '../clients/prisma';

const findById = (id: string) =>
  prisma.pond.findUnique({
    where: { id },
    include: {
      farm: true,
    },
  });

export const PondRepository = {
  findById,
};
