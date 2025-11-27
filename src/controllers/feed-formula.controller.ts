import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { FeedFormulaService } from '../services/feed-formula.service';

const createFeedFormula = async (req: AuthenticatedRequest, res: Response) => {
  const { name, targetStage, description, recommendations } = req.body;

  // Validation
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ message: 'Name is required and must be a non-empty string' });
  }

  if (!targetStage || typeof targetStage !== 'string' || targetStage.trim().length === 0) {
    return res.status(400).json({
      message: 'Target stage is required and must be a non-empty string',
    });
  }

  if (description !== undefined && typeof description !== 'string') {
    return res.status(400).json({ message: 'Description must be a string' });
  }

  if (recommendations !== undefined && typeof recommendations !== 'string') {
    return res.status(400).json({ message: 'Recommendations must be a string' });
  }

  const result = await FeedFormulaService.createFeedFormula({
    name: name.trim(),
    targetStage: targetStage.trim(),
    description: description?.trim(),
    recommendations: recommendations?.trim(),
    createdBy: req.user!.id,
  });

  return res.status(201).json({ data: result });
};

const getFeedFormulaList = async (req: AuthenticatedRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;

  // Validate pagination params
  if (page < 1 || limit < 1 || limit > 100) {
    return res.status(400).json({
      message: 'Invalid pagination parameters. Page must be >= 1, limit must be between 1-100',
    });
  }

  const result = await FeedFormulaService.getFeedFormulaList({ page, limit });

  return res.json({ data: result });
};

const getFeedFormulaById = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: 'Feed formula ID is required' });
  }

  const result = await FeedFormulaService.getFeedFormulaById(id);

  if (!result) {
    return res.status(404).json({ message: 'Feed formula not found' });
  }

  return res.json({ data: result });
};

const updateFeedFormula = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { name, targetStage, description, recommendations } = req.body;

  if (!id) {
    return res.status(400).json({ message: 'Feed formula ID is required' });
  }

  // Validation
  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
    return res.status(400).json({ message: 'Name must be a non-empty string' });
  }

  if (
    targetStage !== undefined &&
    (typeof targetStage !== 'string' || targetStage.trim().length === 0)
  ) {
    return res.status(400).json({ message: 'Target stage must be a non-empty string' });
  }

  if (description !== undefined && typeof description !== 'string') {
    return res.status(400).json({ message: 'Description must be a string' });
  }

  if (recommendations !== undefined && typeof recommendations !== 'string') {
    return res.status(400).json({ message: 'Recommendations must be a string' });
  }

  try {
    const result = await FeedFormulaService.updateFeedFormula(id, {
      name: name?.trim(),
      targetStage: targetStage?.trim(),
      description: description?.trim(),
      recommendations: recommendations?.trim(),
    });

    return res.json({ data: result });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Feed formula not found' });
    }
    throw error;
  }
};

const deleteFeedFormula = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: 'Feed formula ID is required' });
  }

  try {
    await FeedFormulaService.deleteFeedFormula(id);
    return res.json({ message: 'Feed formula deleted successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Feed formula not found' });
    }
    throw error;
  }
};

export const FeedFormulaController = {
  createFeedFormula,
  getFeedFormulaList,
  getFeedFormulaById,
  updateFeedFormula,
  deleteFeedFormula,
};
