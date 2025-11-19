import { NextFunction, Response } from 'express';
import { AuthenticatedRequest, AuthenticatedUser } from '../middlewares/auth.middleware';
import { StatsService } from '../services/stats.service';
import { createHttpError } from '../utils/httpError';
import { AccessService } from '../services/access.service';

const ensureAuthenticated = (req: AuthenticatedRequest): AuthenticatedUser => {
  if (!req.user) {
    throw createHttpError(401, 'Unauthorized');
  }
  return req.user;
};

const getCycleStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = ensureAuthenticated(req);
    const { id } = req.params;

    if (!id) {
      throw createHttpError(400, 'cycle id is required');
    }

    const cycle = await AccessService.ensureCycleAccess(id, user, { allowRoles: ['RESEARCHER'] });

    if (!cycle.pond) {
      throw createHttpError(500, 'Production cycle is missing pond relation');
    }

    const stats = await StatsService.getCycleStats({
      cycleId: cycle.id,
      pondId: cycle.pond.id,
      initialStockCount: cycle.initialStockCount ?? null,
    });

    res.json({ data: stats });
  } catch (error) {
    next(error);
  }
};

export const StatsController = {
  getCycleStats,
};
