import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { RecordController } from '../controllers/record.controller';

const router = Router();

// Specific paths first
router.get('/form-state', authMiddleware, RecordController.getFormState);

// General paths
router.get('/', authMiddleware, RecordController.getRecords);
router.post('/', authMiddleware, RecordController.createRecord);

// ID paths
router.get('/:id', authMiddleware, RecordController.getRecordById);
router.put('/:id', authMiddleware, RecordController.updateRecord);
router.delete('/:id', authMiddleware, RecordController.deleteRecord);

export { router as recordRouter };
