import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { DashboardController } from '../controllers/dashboard.controller';

const router = Router();

router.get('/groups/:groupType', authMiddleware, DashboardController.getDashboardByFarmType);

export { router as dashboardRouter };
