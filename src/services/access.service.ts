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
    },
  });

  if (!cycle) {
    throw createHttpError(404, 'Production cycle not found');
  }

  // Warning: Access control on ProductionCycle is temporarily disabled 
  // because the link to Farm/Owner via Pond was removed.
  // authorizeOwnership(..., user, options?.allowRoles); 
  return cycle;
};

export const AccessService = {
  ensureFarmAccess,
  ensureCycleAccess,
};
