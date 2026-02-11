import { Router } from 'express';
import { PondController } from '../controllers/pond.controller';

const router = Router();

router.get('/:id/active-cycle', PondController.getActiveCycle);
router.post('/:id/end-cycle', PondController.endCycle);

export { router as pondRouter };
