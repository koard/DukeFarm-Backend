import { Router } from 'express';
import { v1Router } from './v1';
import { authRouter } from './auth.routes';
import { homeRouter } from './home.routes';
import { dashboardRouter } from './dashboard.routes';
import { registerRouter } from './register.routes';
import { farmerRouter } from './farmer.routes';
import { feedFormulaRouter } from './feed-formula.routes';
import { researcherRouter } from './researcher.routes';
import { recordRouter } from './record.routes';
import { diseaseAnalyzerRouter } from './disease-analyzer.routes';

import { pondRouter } from './pond.routes';

const router = Router();

router.use('/v1', v1Router);
router.use('/auth', authRouter);
router.use('/register', registerRouter);
router.use('/dashboard', dashboardRouter);
router.use('/farmers', farmerRouter);
router.use('/feed-formulas', feedFormulaRouter);
router.use('/researchers', researcherRouter);
router.use('/records', recordRouter);
router.use('/ponds', pondRouter);
router.use('/', diseaseAnalyzerRouter);
router.use('/', homeRouter);

export { router };
