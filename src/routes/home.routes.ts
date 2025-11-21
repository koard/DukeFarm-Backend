import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { HomeController } from '../controllers/home.controller';

const router = Router();

router.get('/home/groups/:groupType', authMiddleware, HomeController.getGroupOverview);

export { router as homeRouter };
