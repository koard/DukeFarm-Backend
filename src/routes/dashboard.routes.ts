import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { HomeController } from '../controllers/home.controller';

const router = Router();

router.get('/groups/:groupType', authMiddleware, HomeController.getGroupOverview);

export { router as dashboardRouter };
