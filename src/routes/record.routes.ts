import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { RecordController } from '../controllers/record.controller';

const router = Router();

router.get('/form-state', authMiddleware, RecordController.getFormState);
router.get('/', authMiddleware, RecordController.getRecords);
router.post('/', authMiddleware, RecordController.createRecord);
router.put('/:id', authMiddleware, RecordController.updateRecord);
router.delete('/:id', authMiddleware, RecordController.deleteRecord);

export { router as recordRouter };
