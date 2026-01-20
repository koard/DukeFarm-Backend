import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { createHttpError } from '../utils/httpError';
import { DashboardService } from '../services/dashboard.service';

const getDashboardByFarmType = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      throw createHttpError(401, 'Unauthorized');
    }

    let farmType;
    try {
      farmType = DashboardService.parseFarmTypeParam(req.params.groupType);
    } catch (parseError) {
      throw createHttpError(400, (parseError as Error).message);
    }
    const dashboard = await DashboardService.getDashboard(user.id, user.role, farmType);

    res.json({ data: dashboard });
  } catch (error) {
    next(error);
  }
};

export const DashboardController = {
  getDashboardByFarmType,
};
