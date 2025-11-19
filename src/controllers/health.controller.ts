import { NextFunction, Request, Response } from 'express';
import { HealthService } from '../services/health.service';

const check = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await HealthService.getHealthStatus();
    res.json(status);
  } catch (error) {
    next(error);
  }
};

export const HealthController = {
  check,
};
