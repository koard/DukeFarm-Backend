import { Router } from 'express';
import { healthRouter } from './health.routes';
import { weatherRouter } from './weather.routes';

const router = Router();

router.use(healthRouter);
router.use(weatherRouter);

export { router as v1Router };
