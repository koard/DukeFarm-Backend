import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { OnboardingController } from '../controllers/onboarding.controller';

const router = Router();

router.use(authMiddleware);
router.post('/role', OnboardingController.selectRole);
router.post('/farmer', OnboardingController.submitFarmerProfile);
router.post('/researcher', OnboardingController.submitResearcherProfile);

export { router as onboardingRouter };
