import { Router } from 'express';
import { v1Router } from './v1';
import { authRouter } from './auth.routes';
import { homeRouter } from './home.routes';
import { onboardingRouter } from './onboarding.routes';
import { farmerRouter } from './farmer.routes';
import { feedFormulaRouter } from './feed-formula.routes';

const router = Router();

router.use('/v1', v1Router);
router.use('/auth', authRouter);
router.use('/onboarding', onboardingRouter);
router.use('/farmers', farmerRouter);
router.use('/feed-formulas', feedFormulaRouter);
router.use('/', homeRouter);

export { router };
