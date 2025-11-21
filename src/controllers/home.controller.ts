import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { createHttpError } from '../utils/httpError';
import { HomeService } from '../services/home.service';

const getGroupOverview = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      throw createHttpError(401, 'Unauthorized');
    }

    let groupType;
    try {
      groupType = HomeService.parseGroupParam(req.params.groupType);
    } catch (parseError) {
      throw createHttpError(400, (parseError as Error).message);
    }
    const overview = await HomeService.getGroupOverview(user.id, groupType);

    res.json({ data: overview });
  } catch (error) {
    next(error);
  }
};

export const HomeController = {
  getGroupOverview,
};
