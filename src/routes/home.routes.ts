import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { HomeController } from '../controllers/home.controller';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json({
    service: 'DukeFarm API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/v1/health',
      authentication: '/api/auth/line/login',
      register: '/api/register/*',
      dashboard: '/api/dashboard/*',
      farmers: '/api/farmers',
      feedFormulas: '/api/feed-formulas',
      researchers: '/api/researchers',
      documentation: 'https://github.com/koard/DukeFarm-Backend',
    },
  });
});

export { router as homeRouter };
