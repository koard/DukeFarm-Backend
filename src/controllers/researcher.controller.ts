import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { ResearcherService } from '../services/researcher.service';

const getResearcherList = async (req: AuthenticatedRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;

  if (page < 1 || limit < 1 || limit > 100) {
    return res.status(400).json({
      message: 'Invalid pagination parameters. Page must be >= 1, limit must be between 1-100',
    });
  }

  const result = await ResearcherService.getResearcherList({ page, limit });

  return res.json({ data: result });
};

const getResearchSurveysByResearcher = async (req: AuthenticatedRequest, res: Response) => {
  const { researcherId } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;

  if (!researcherId) {
    return res.status(400).json({ message: 'Researcher ID is required' });
  }

  if (page < 1 || limit < 1 || limit > 100) {
    return res.status(400).json({
      message: 'Invalid pagination parameters. Page must be >= 1, limit must be between 1-100',
    });
  }

  const result = await ResearcherService.getResearchSurveysByResearcher(researcherId, {
    page,
    limit,
  });

  return res.json({ data: result });
};

const getResearchSurveyDetail = async (req: AuthenticatedRequest, res: Response) => {
  const { surveyId } = req.params;

  if (!surveyId) {
    return res.status(400).json({ message: 'Survey ID is required' });
  }

  const result = await ResearcherService.getResearchSurveyDetail(surveyId);

  if (!result) {
    return res.status(404).json({ message: 'Research survey not found' });
  }

  return res.json({ data: result });
};

export const ResearcherController = {
  getResearcherList,
  getResearchSurveysByResearcher,
  getResearchSurveyDetail,
};
