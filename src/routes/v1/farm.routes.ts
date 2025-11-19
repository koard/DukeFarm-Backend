import { Router, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';

const router = Router();

router.get(
  '/farms',
  authMiddleware,
  roleMiddleware(['ADMIN', 'FARMER']),
  (req: AuthenticatedRequest, res: Response) => {
    res.json({ message: 'Protected farms resource', user: req.user });
  },
);

export { router as farmRouter };
