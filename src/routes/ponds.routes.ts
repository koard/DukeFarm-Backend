import { Router } from 'express';
import { PondsController } from '../controllers/ponds.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';

const farmPondsRouter = Router({ mergeParams: true });
farmPondsRouter.use(authMiddleware);

farmPondsRouter.get('/', roleMiddleware(['ADMIN', 'FARMER']), PondsController.listByFarm);
farmPondsRouter.post('/', roleMiddleware(['ADMIN', 'FARMER']), PondsController.create);

const pondsRouter = Router();
pondsRouter.use(authMiddleware);

pondsRouter.get('/:id', roleMiddleware(['ADMIN', 'FARMER']), PondsController.getById);
pondsRouter.patch('/:id', roleMiddleware(['ADMIN', 'FARMER']), PondsController.update);
pondsRouter.get('/:id/weather', roleMiddleware(['ADMIN', 'FARMER']), PondsController.getWeather);

export { farmPondsRouter, pondsRouter };
