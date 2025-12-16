import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { DiseaseAnalyzerController } from '../controllers/disease-analyzer.controller';

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    const isAllowed = allowed.includes(file.mimetype);
    if (!isAllowed) return cb(new Error('Invalid file type'));
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

const diseaseAnalyzerRouter = Router();

// Disease database endpoints
diseaseAnalyzerRouter.get('/diseases', DiseaseAnalyzerController.searchDiseases);
diseaseAnalyzerRouter.get('/diseases/:id', DiseaseAnalyzerController.getDisease);

// Disease analyzer endpoints
diseaseAnalyzerRouter.post('/disease-analyzer', upload.single('photo'), DiseaseAnalyzerController.analyze);
diseaseAnalyzerRouter.get('/disease-analyzer/:id', DiseaseAnalyzerController.getResult);

export { diseaseAnalyzerRouter };
