import { Router } from 'express';
import { LineAuthController } from '../controllers/lineAuth.controller';

const router = Router();

router.get('/line/login', LineAuthController.getLineLoginUrl);
router.get('/line/callback', LineAuthController.handleLineCallback);

export { router as authRouter };
