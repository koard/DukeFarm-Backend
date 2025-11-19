import { Router } from 'express';
import { StatsController } from '../controllers/stats.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';

const cyclesRouter = Router();

cyclesRouter.use(authMiddleware);

cyclesRouter.get(
  '/:id/stats',
  roleMiddleware(['ADMIN', 'FARMER', 'RESEARCHER']),
  StatsController.getCycleStats,
);

export { cyclesRouter };
