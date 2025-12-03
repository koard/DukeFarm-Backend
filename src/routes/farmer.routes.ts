import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { FarmerController } from '../controllers/farmer.controller';

const farmerRouter = Router();

// GET /api/farmers - List all registered farmers (Admin/Researcher only)
farmerRouter.get(
  '/',
  authMiddleware,
  roleMiddleware(['ADMIN', 'RESEARCHER']),
  FarmerController.getFarmerList,
);

// GET /api/farmers/:farmerId - Fetch single farmer detail (Admin/Researcher only)
farmerRouter.get(
  '/:farmerId',
  authMiddleware,
  roleMiddleware(['ADMIN', 'RESEARCHER']),
  FarmerController.getFarmerById,
);

// DELETE /api/farmers/:farmerId - Remove farmer account (Admin only)
farmerRouter.delete(
  '/:farmerId',
  authMiddleware,
  roleMiddleware(['ADMIN']),
  FarmerController.deleteFarmer,
);

export { farmerRouter };
