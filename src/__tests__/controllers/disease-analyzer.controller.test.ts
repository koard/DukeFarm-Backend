import request from 'supertest';
import path from 'path';
import { createApp } from '../../app';
import { DiseaseAnalyzerService } from '../../services/disease-analyzer.service';

// Mock the service
jest.mock('../../services/disease-analyzer.service', () => ({
  DiseaseAnalyzerService: {
    getSymptomChips: jest.fn(),
    analyze: jest.fn(),
    getResult: jest.fn(),
    listAnalysisRequests: jest.fn(),
    searchDiseases: jest.fn(),
    getDisease: jest.fn(),
    createDisease: jest.fn(),
    updateDisease: jest.fn(),
    deleteDisease: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockGetSymptomChips = DiseaseAnalyzerService.getSymptomChips as jest.Mock;
const mockAnalyze = DiseaseAnalyzerService.analyze as jest.Mock;
const mockGetResult = DiseaseAnalyzerService.getResult as jest.Mock;
const mockListRequests = DiseaseAnalyzerService.listAnalysisRequests as jest.Mock;
const mockSearchDiseases = DiseaseAnalyzerService.searchDiseases as jest.Mock;
const mockGetDisease = DiseaseAnalyzerService.getDisease as jest.Mock;
const mockCreateDisease = DiseaseAnalyzerService.createDisease as jest.Mock;
const mockUpdateDisease = DiseaseAnalyzerService.updateDisease as jest.Mock;
const mockDeleteDisease = DiseaseAnalyzerService.deleteDisease as jest.Mock;

describe('Disease Analyzer Controller', () => {
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/symptoms', () => {
    it('should return list of symptom chips', async () => {
      mockGetSymptomChips.mockResolvedValue(['chip1', 'chip2']);

      const response = await request(app).get('/api/symptoms');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(['chip1', 'chip2']);
    });
  });

  describe('POST /api/disease-analyzer', () => {
    it('should require symptomText', async () => {
      const response = await request(app)
        .post('/api/disease-analyzer')
        .send({ symptomTags: [] });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('symptomText is required');
    });

    it('should analyze symptoms successfully without photo', async () => {
      mockAnalyze.mockResolvedValue({
        requestId: 'req-1',
        photoPath: null,
        results: [{ disease: 'A', score: 0.9 }],
      });

      const response = await request(app)
        .post('/api/disease-analyzer')
        .send({ symptomText: 'จุดขาว', symptomTags: '["tag1"]' });

      expect(response.status).toBe(201);
      expect(response.body.data.requestId).toBe('req-1');
      expect(mockAnalyze).toHaveBeenCalledWith(
        expect.objectContaining({
          symptomText: 'จุดขาว',
          symptomTags: ['tag1'],
          file: undefined, // no file uploaded
        }),
      );
    });

    it('should handle photo uploads multipart/form-data', async () => {
      mockAnalyze.mockResolvedValue({
        requestId: 'req-1',
        photoPath: '/uploads/mock.png',
        results: [],
      });

      // Create a dummy file for testing
      const testFilePath = path.join(__dirname, 'dummy.png');
      const fs = require('fs');
      fs.writeFileSync(testFilePath, 'dummy content');

      const response = await request(app)
        .post('/api/disease-analyzer')
        .field('symptomText', 'test symptom')
        .field('symptomTags', '[]')
        .attach('photo', testFilePath);

      // Clean up dummy file
      fs.unlinkSync(testFilePath);

      expect(response.status).toBe(201);
      expect(mockAnalyze).toHaveBeenCalledWith(
        expect.objectContaining({
          file: expect.objectContaining({ fieldname: 'photo' }),
        }),
      );
    });
  });

  describe('GET /api/disease-analyzer/:id', () => {
    it('should return 404 for unknown request ID', async () => {
      mockGetResult.mockResolvedValue(null);

      const response = await request(app).get('/api/disease-analyzer/uuid-123');

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Not Found');
    });

    it('should return result details for valid request ID', async () => {
      mockGetResult.mockResolvedValue({ id: 'uuid-123', symptomText: 'test' });

      const response = await request(app).get('/api/disease-analyzer/uuid-123');

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe('uuid-123');
    });
  });

  describe('GET /api/disease-analyzer/requests', () => {
    it('should validate target params', async () => {
      const response = await request(app).get('/api/disease-analyzer/requests?page=one');
      // Number util will handle NaN converting it or throwing
      expect(response.status).toBe(400); 
    });

    it('should list analysis requests', async () => {
      mockListRequests.mockResolvedValue({ data: [], pagination: {} });

      const response = await request(app).get('/api/disease-analyzer/requests');

      expect(response.status).toBe(200);
      expect(mockListRequests).toHaveBeenCalled();
    });

    it('should validate limit range', async () => {
      const response = await request(app).get('/api/disease-analyzer/requests?limit=999');
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/diseases', () => {
    it('should search database', async () => {
      mockSearchDiseases.mockResolvedValue({ data: [], pagination: {} });

      const response = await request(app).get('/api/diseases?symptoms=test');

      expect(response.status).toBe(200);
      expect(mockSearchDiseases).toHaveBeenCalledWith(
        expect.objectContaining({ symptoms: 'test' }),
      );
    });

    it('should validate invalid page query', async () => {
      const response = await request(app).get('/api/diseases?page=0');
      expect(response.status).toBe(400);
    });
  });

  describe('Disease CRUD endpoints', () => {
    it('GET /api/diseases/:id should return 404 when not found', async () => {
      mockGetDisease.mockResolvedValue(null);

      const response = await request(app).get('/api/diseases/d1');

      expect(response.status).toBe(404);
    });

    it('POST /api/diseases should validate required fields', async () => {
      const response = await request(app).post('/api/diseases').send({ name: 'x' });

      expect(response.status).toBe(400);
    });

    it('POST /api/diseases should create disease', async () => {
      mockCreateDisease.mockResolvedValue({ id: 'd1' });

      const response = await request(app)
        .post('/api/diseases')
        .send({ name: 'โรค A', category: 'BACTERIAL', symptoms: ['a'] });

      expect(response.status).toBe(201);
      expect(response.body.data.id).toBe('d1');
    });

    it('PUT /api/diseases/:id should return 404 when update target missing', async () => {
      mockUpdateDisease.mockResolvedValue(null);

      const response = await request(app).put('/api/diseases/d404').send({ name: 'updated' });

      expect(response.status).toBe(404);
    });

    it('DELETE /api/diseases/:id should return 204', async () => {
      mockDeleteDisease.mockResolvedValue(undefined);

      const response = await request(app).delete('/api/diseases/d1');

      expect(response.status).toBe(204);
    });
  });
});
