import { Router } from 'express';
import { v1Router } from './v1';
import { authRouter } from './auth.routes';
import { cyclesRouter } from './stats.routes';
import { homeRouter } from './home.routes';
import { onboardingRouter } from './onboarding.routes';

const router = Router();

router.use('/v1', v1Router);
router.use('/auth', authRouter);
router.use('/cycles', cyclesRouter);
router.use('/onboarding', onboardingRouter);
router.use('/', homeRouter);

export { router };
