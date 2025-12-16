import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { DiseaseAnalyzerService } from '../services/disease-analyzer.service';

export const DiseaseAnalyzerController = {
  analyze: async (req: AuthenticatedRequest, res: Response) => {
    const { symptomText, symptomTags } = req.body;
    if (!symptomText || typeof symptomText !== 'string') {
      return res.status(400).json({ message: 'symptomText is required' });
    }

    let tags: string[] = [];
    if (symptomTags) {
      try {
        const parsed = typeof symptomTags === 'string' ? JSON.parse(symptomTags) : symptomTags;
        if (Array.isArray(parsed)) {
          tags = parsed.filter((t) => typeof t === 'string');
        }
      } catch (err) {
        return res.status(400).json({ message: 'symptomTags must be a JSON array of strings' });
      }
    }

    const file = (req as any).file as Express.Multer.File | undefined;

    const result = await DiseaseAnalyzerService.analyze({
      symptomText,
      symptomTags: tags,
      file,
    });

    return res.status(201).json({ data: result });
  },

  getResult: async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'id is required' });

    const result = await DiseaseAnalyzerService.getResult(id);
    if (!result) return res.status(404).json({ message: 'Not Found' });

    return res.json({ data: result });
  },

  searchDiseases: async (req: AuthenticatedRequest, res: Response) => {
    const { symptoms, category, page = '1', limit = '10' } = req.query;
    
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);

    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({ message: 'page must be a positive integer' });
    }
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({ message: 'limit must be between 1 and 100' });
    }

    const result = await DiseaseAnalyzerService.searchDiseases({
      symptoms: symptoms as string | undefined,
      category: category as string | undefined,
      page: pageNum,
      limit: limitNum,
    });

    return res.json({ data: result });
  },

  getDisease: async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'id is required' });

    const disease = await DiseaseAnalyzerService.getDisease(id);
    if (!disease) return res.status(404).json({ message: 'Disease not found' });

    return res.json({ data: disease });
  },
};
