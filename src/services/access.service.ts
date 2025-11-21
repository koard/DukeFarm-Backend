import { AuthenticatedUser } from '../middlewares/auth.middleware';
import { prisma } from '../clients/prisma';
import { createHttpError } from '../utils/httpError';

const resolveRole = (user: AuthenticatedUser) => user.role ?? 'FARMER';

const isAdmin = (user: AuthenticatedUser) => resolveRole(user) === 'ADMIN';

const authorizeOwnership = (
  ownerId: string,
  user: AuthenticatedUser,
  allowedRoles: string[] = [],
) => {
  if (isAdmin(user) || ownerId === user.id || allowedRoles.includes(resolveRole(user))) {
    return;
  }

  throw createHttpError(403, 'Forbidden');
};

const ensureFarmAccess = async (
  farmId: string,
  user: AuthenticatedUser,
  options?: { allowRoles?: string[] },
) => {
  const farm = await prisma.farm.findUnique({
    where: { id: farmId },
    select: { id: true, ownerId: true },
  });

  if (!farm) {
    throw createHttpError(404, 'Farm not found');
  }

  authorizeOwnership(farm.ownerId, user, options?.allowRoles);
  return farm;
};

const ensurePondAccess = async (
  pondId: string,
  user: AuthenticatedUser,
  options?: { allowRoles?: string[] },
) => {
  const pond = await prisma.pond.findUnique({
    where: { id: pondId },
    include: {
      farm: { select: { id: true, ownerId: true, latitude: true, longitude: true } },
    },
  });

  if (!pond) {
    throw createHttpError(404, 'Pond not found');
  }

  if (!pond.farm) {
    throw createHttpError(500, 'Pond is missing farm relation');
  }

  authorizeOwnership(pond.farm.ownerId, user, options?.allowRoles);
  return pond;
};

const ensureCycleAccess = async (
  cycleId: string,
  user: AuthenticatedUser,
  options?: { allowRoles?: string[] },
) => {
  const cycle = await prisma.productionCycle.findUnique({
    where: { id: cycleId },
    select: {
      id: true,
      initialStockCount: true,
      pond: {
        select: {
          id: true,
          farm: {
            select: {
              id: true,
              ownerId: true,
              latitude: true,
              longitude: true,
            },
          },
        },
      },
    },
  });

  if (!cycle || !cycle.pond || !cycle.pond.farm) {
    throw createHttpError(404, 'Production cycle not found');
  }

  authorizeOwnership(cycle.pond.farm.ownerId, user, options?.allowRoles);
  return cycle;
};

export const AccessService = {
  ensureFarmAccess,
  ensurePondAccess,
  ensureCycleAccess,
};
