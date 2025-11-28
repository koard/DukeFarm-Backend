import { Router } from 'express';
import { LineAuthController } from '../controllers/lineAuth.controller';
import { AdminController } from '../controllers/admin.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// LINE Login routes
router.get('/line/login', LineAuthController.getLineLoginUrl);
router.get('/line/callback', LineAuthController.handleLineCallback);

// Admin login routes
router.post('/admin/login', AdminController.login);
router.post('/admin/create', AdminController.createAdmin); // TODO: Protect this endpoint after creating admins

// User profile route
router.get('/me', authMiddleware, LineAuthController.getMe);

export { router as authRouter };
