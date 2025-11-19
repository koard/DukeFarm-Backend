import { Router } from 'express';
import { FarmsController } from '../controllers/farms.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', roleMiddleware(['ADMIN', 'FARMER', 'RESEARCHER']), FarmsController.list);
router.post('/', roleMiddleware(['ADMIN', 'FARMER']), FarmsController.create);
router.get('/:id', roleMiddleware(['ADMIN', 'FARMER', 'RESEARCHER']), FarmsController.getById);
router.patch('/:id', roleMiddleware(['ADMIN', 'FARMER']), FarmsController.update);

export { router as farmsRouter };
