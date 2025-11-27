import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { FarmerService } from '../services/farmer.service';

const getFarmerList = async (req: AuthenticatedRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;

  // Validate pagination params
  if (page < 1 || limit < 1 || limit > 100) {
    return res.status(400).json({
      message: 'Invalid pagination parameters. Page must be >= 1, limit must be between 1-100',
    });
  }

  const result = await FarmerService.getFarmerList({ page, limit });

  return res.json({ data: result });
};

export const FarmerController = {
  getFarmerList,
};
