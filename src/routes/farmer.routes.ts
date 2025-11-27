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

export { farmerRouter };
