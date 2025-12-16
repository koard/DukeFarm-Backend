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
};
