import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { ResearcherController } from '../controllers/researcher.controller';

const researcherRouter = Router();

// GET /api/researchers - List all researchers (Admin only)
researcherRouter.get(
  '/',
  authMiddleware,
  roleMiddleware(['ADMIN']),
  ResearcherController.getResearcherList,
);

// GET /api/researchers/:researcherId/surveys - List surveys by researcher (Admin/Researcher)
researcherRouter.get(
  '/:researcherId/surveys',
  authMiddleware,
  roleMiddleware(['ADMIN', 'RESEARCHER']),
  ResearcherController.getResearchSurveysByResearcher,
);

// GET /api/researchers/surveys/:surveyId - Get survey detail (Admin/Researcher)
researcherRouter.get(
  '/surveys/:surveyId',
  authMiddleware,
  roleMiddleware(['ADMIN', 'RESEARCHER']),
  ResearcherController.getResearchSurveyDetail,
);

export { researcherRouter };
