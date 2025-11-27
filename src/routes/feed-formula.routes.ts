import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { FeedFormulaController } from '../controllers/feed-formula.controller';

const feedFormulaRouter = Router();

// POST /api/feed-formulas - Create feed formula (Admin only)
feedFormulaRouter.post(
  '/',
  authMiddleware,
  roleMiddleware(['ADMIN']),
  FeedFormulaController.createFeedFormula,
);

// GET /api/feed-formulas - List all feed formulas (All authenticated users)
feedFormulaRouter.get(
  '/',
  authMiddleware,
  FeedFormulaController.getFeedFormulaList,
);

// GET /api/feed-formulas/:id - Get feed formula by ID (All authenticated users)
feedFormulaRouter.get(
  '/:id',
  authMiddleware,
  FeedFormulaController.getFeedFormulaById,
);

// PUT /api/feed-formulas/:id - Update feed formula (Admin only)
feedFormulaRouter.put(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN']),
  FeedFormulaController.updateFeedFormula,
);

// DELETE /api/feed-formulas/:id - Delete feed formula (Admin only)
feedFormulaRouter.delete(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN']),
  FeedFormulaController.deleteFeedFormula,
);

export { feedFormulaRouter };
