import { Router } from 'express';
import { LineAuthController } from '../controllers/lineAuth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.get('/line/login', LineAuthController.getLineLoginUrl);
router.get('/line/callback', LineAuthController.handleLineCallback);
router.get('/me', authMiddleware, LineAuthController.getMe);

export { router as authRouter };
