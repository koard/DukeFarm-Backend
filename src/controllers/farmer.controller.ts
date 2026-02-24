import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { FarmerService } from '../services/farmer.service';

const getFarmerList = async (req: AuthenticatedRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
  const farmType = typeof req.query.farmType === 'string' && ['SMALL', 'LARGE', 'MARKET'].includes(req.query.farmType)
    ? (req.query.farmType as any)
    : undefined;

  // Validate pagination params
  if (page < 1 || limit < 1 || limit > 100) {
    return res.status(400).json({
      message: 'Invalid pagination parameters. Page must be >= 1, limit must be between 1-100',
    });
  }

  const params: Parameters<typeof FarmerService.getFarmerList>[0] = { page, limit };
  if (search) params.search = search;
  if (farmType) params.farmType = farmType;

  const result = await FarmerService.getFarmerList(params);

  return res.json({ data: result });
};

const getFarmerById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const { farmerId } = req.params;

  if (!farmerId) {
    return res.status(400).json({ message: 'Farmer ID is required' });
  }

  try {
    const farmType = req.query.farmType as string | undefined; // Optional farm type filter

    // Validate farmType if provided
    let validFarmType: any = undefined;
    if (farmType && ['SMALL', 'LARGE', 'MARKET', 'ALL'].includes(farmType)) {
      validFarmType = farmType;
    }

    const farmer = await FarmerService.getFarmerById(farmerId, validFarmType);
    return res.json({ data: farmer });
  } catch (error) {
    return next(error);
  }
};

const deleteFarmer = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const { farmerId } = req.params;

  if (!farmerId) {
    return res.status(400).json({ message: 'Farmer ID is required' });
  }

  try {
    await FarmerService.deleteFarmerById(farmerId);
    return res.json({ message: 'Farmer deleted successfully' });
  } catch (error) {
    return next(error);
  }
};

export const FarmerController = {
  getFarmerList,
  getFarmerById,
  deleteFarmer,
};
