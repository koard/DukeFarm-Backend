import { Router } from 'express';
import { PondController } from '../controllers/pond.controller';

const router = Router();

router.get('/:id/active-cycle', PondController.getActiveCycle);
router.get('/:id/cycles', PondController.listCycles);
router.get('/:id/cycle-count', PondController.getCycleCount);
router.post('/:id/end-cycle', PondController.endCycle);
router.post('/:id/start-cycle', PondController.startNewCycle);

export { router as pondRouter };
