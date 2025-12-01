import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { RecordController } from '../controllers/record.controller';

const router = Router();

router.get('/form-state', authMiddleware, RecordController.getFormState);
router.post('/', authMiddleware, RecordController.createRecord);

export { router as recordRouter };
