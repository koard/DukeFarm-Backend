import { Router } from 'express';
import { v1Router } from './v1';
import { authRouter } from './auth.routes';
import { farmsRouter } from './farms.routes';
import { farmPondsRouter, pondsRouter } from './ponds.routes';
import { cyclesRouter } from './stats.routes';

const router = Router();

router.use('/v1', v1Router);
router.use('/auth', authRouter);
router.use('/farms/:farmId/ponds', farmPondsRouter);
router.use('/farms', farmsRouter);
router.use('/ponds', pondsRouter);
router.use('/cycles', cyclesRouter);

export { router };
