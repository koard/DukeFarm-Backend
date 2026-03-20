// Mock Prisma
jest.mock('../../clients/prisma', () => ({
  prisma: {
    disease: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    diseaseAnalysisRequest: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    diseaseMatch: {
      create: jest.fn(),
    },
    diseaseSymptom: {
      deleteMany: jest.fn(),
    },
    uploadedFile: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
    $disconnect: jest.fn(),
  },
}));

jest.mock('../../config/env', () => ({
  env: { jwtSecret: 'test-secret' },
}));

import { DiseaseAnalyzerService } from '../../services/disease-analyzer.service';
import { prisma } from '../../clients/prisma';

const mockDiseaseFindMany = prisma.disease.findMany as jest.Mock;
const mockDiseaseFindUnique = prisma.disease.findUnique as jest.Mock;
const mockDiseaseCount = prisma.disease.count as jest.Mock;
const mockDiseaseCreate = prisma.disease.create as jest.Mock;
const mockDiseaseUpdate = prisma.disease.update as jest.Mock;
const mockDiseaseDelete = prisma.disease.delete as jest.Mock;
const mockRequestCreate = prisma.diseaseAnalysisRequest.create as jest.Mock;
const mockRequestFindUnique = prisma.diseaseAnalysisRequest.findUnique as jest.Mock;
const mockRequestFindMany = prisma.diseaseAnalysisRequest.findMany as jest.Mock;
const mockRequestCount = prisma.diseaseAnalysisRequest.count as jest.Mock;
const mockTransaction = prisma.$transaction as jest.Mock;
const mockSymptomDeleteMany = prisma.diseaseSymptom.deleteMany as jest.Mock;
const mockUploadedFileCreate = prisma.uploadedFile.create as jest.Mock;
const mockUploadedFileFindUnique = prisma.uploadedFile.findUnique as jest.Mock;

describe('DiseaseAnalyzerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSymptomChips', () => {
    it('should return an array of symptom chips', async () => {
      const chips = await DiseaseAnalyzerService.getSymptomChips();

      expect(Array.isArray(chips)).toBe(true);
      expect(chips.length).toBeGreaterThan(0);
      expect(chips).toContain('ถูตัว');
      expect(chips).toContain('เบื่ออาหาร');
      expect(chips).toContain('จุดขาว');
    });
  });

  describe('analyze', () => {
    const mockDiseases = [
      {
        id: 'disease-1',
        name: 'จุดขาว',
        category: 'ปรสิต',
        symptoms: 'จุดขาว ถูตัว เบื่ออาหาร',
        causes: 'ปรสิต Ich',
        treatment: 'ใช้ยา',
        treatmentSummary: 'รักษาด้วยยา',
        tags: [{ label: 'จุดขาว' }, { label: 'ถูตัว' }],
      },
      {
        id: 'disease-2',
        name: 'ครีบกร่อน',
        category: 'แบคทีเรีย',
        symptoms: 'ครีบกร่อน แผลหลุม',
        causes: 'แบคทีเรีย',
        treatment: 'ยาปฏิชีวนะ',
        treatmentSummary: 'รักษาด้วยยาปฏิชีวนะ',
        tags: [{ label: 'ครีบกร่อน' }, { label: 'แผลหลุม' }],
      },
    ];

    beforeEach(() => {
      mockRequestCreate.mockResolvedValue({ id: 'request-1' });
      mockDiseaseFindMany.mockResolvedValue(mockDiseases);
      mockTransaction.mockResolvedValue([]);
    });

    it('should create an analysis request', async () => {
      await DiseaseAnalyzerService.analyze({
        symptomText: 'จุดขาว',
        symptomTags: [],
      });

      expect(mockRequestCreate).toHaveBeenCalledWith({
        data: {
          symptomText: 'จุดขาว',
          symptomTags: [],
          photoId: null,
        },
      });
    });

    it('should return request ID and results', async () => {
      const result = await DiseaseAnalyzerService.analyze({
        symptomText: 'จุดขาว ถูตัว',
        symptomTags: [],
      });

      expect(result.requestId).toBe('request-1');
      expect(result).toHaveProperty('results');
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should match and rank diseases by score', async () => {
      const result = await DiseaseAnalyzerService.analyze({
        symptomText: 'จุดขาว ถูตัว',
        symptomTags: [],
      });

      if (result.results.length > 0) {
        // Results should be sorted by score (highest first)
        for (let i = 1; i < result.results.length; i++) {
          expect(result.results[i - 1].score).toBeGreaterThanOrEqual(result.results[i].score);
        }

        // Each result should have a rank
        result.results.forEach((r, idx) => {
          expect(r.rank).toBe(idx + 1);
        });
      }
    });

    it('should handle file upload', async () => {
      mockUploadedFileCreate.mockResolvedValue({ id: 'file-1' });
      mockUploadedFileFindUnique.mockResolvedValue({ filePath: '/uploads/photo.jpg' });

      const result = await DiseaseAnalyzerService.analyze({
        symptomText: 'จุดขาว',
        symptomTags: [],
        file: { path: '/uploads/photo.jpg', mimetype: 'image/jpeg', size: 1024 },
      });

      expect(mockUploadedFileCreate).toHaveBeenCalled();
      expect(result.photoPath).toBe('/uploads/photo.jpg');
    });

    it('should return null photoPath when no file', async () => {
      const result = await DiseaseAnalyzerService.analyze({
        symptomText: 'ครีบกร่อน',
        symptomTags: [],
      });

      expect(result.photoPath).toBeNull();
    });

    it('should handle empty results (no matching diseases)', async () => {
      mockDiseaseFindMany.mockResolvedValue([]);

      const result = await DiseaseAnalyzerService.analyze({
        symptomText: 'something completely unrelated xyz',
        symptomTags: [],
      });

      expect(result.results).toEqual([]);
    });

    it('should limit results to top 5', async () => {
      // Create many diseases
      const manyDiseases = Array.from({ length: 10 }, (_, i) => ({
        id: `disease-${i}`,
        name: `โรค${i} จุดขาว`,
        category: 'test',
        symptoms: 'จุดขาว ถูตัว เบื่ออาหาร',
        causes: '',
        treatment: '',
        treatmentSummary: '',
        tags: [{ label: 'จุดขาว' }],
      }));
      mockDiseaseFindMany.mockResolvedValue(manyDiseases);

      const result = await DiseaseAnalyzerService.analyze({
        symptomText: 'จุดขาว',
        symptomTags: [],
      });

      expect(result.results.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getResult', () => {
    it('should query prisma with correct id', async () => {
      const mockResult = { id: 'req-1', symptomText: 'test' };
      mockRequestFindUnique.mockResolvedValue(mockResult);

      const result = await DiseaseAnalyzerService.getResult('req-1');

      expect(mockRequestFindUnique).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        include: {
          photo: true,
          matches: {
            orderBy: { rank: 'asc' },
            include: { disease: true },
          },
        },
      });
      expect(result).toEqual(mockResult);
    });

    it('should return null when not found', async () => {
      mockRequestFindUnique.mockResolvedValue(null);

      const result = await DiseaseAnalyzerService.getResult('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getDisease', () => {
    it('should query disease by ID with tags', async () => {
      const mockDisease = { id: 'd1', name: 'Test Disease', tags: [] };
      mockDiseaseFindUnique.mockResolvedValue(mockDisease);

      const result = await DiseaseAnalyzerService.getDisease('d1');

      expect(mockDiseaseFindUnique).toHaveBeenCalledWith({
        where: { id: 'd1' },
        include: { tags: true },
      });
      expect(result).toEqual(mockDisease);
    });
  });

  describe('searchDiseases', () => {
    it('should search with pagination', async () => {
      mockDiseaseFindMany.mockResolvedValue([]);
      mockDiseaseCount.mockResolvedValue(0);

      const result = await DiseaseAnalyzerService.searchDiseases({
        page: 1,
        limit: 10,
      });

      expect(result.pagination.currentPage).toBe(1);
      expect(result.pagination.itemsPerPage).toBe(10);
      expect(result.data).toEqual([]);
    });

    it('should filter by category', async () => {
      mockDiseaseFindMany.mockResolvedValue([]);
      mockDiseaseCount.mockResolvedValue(0);

      await DiseaseAnalyzerService.searchDiseases({
        category: 'ปรสิต',
        page: 1,
        limit: 10,
      });

      expect(mockDiseaseFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'ปรสิต' }),
        }),
      );
    });

    it('should filter by symptoms with OR conditions', async () => {
      mockDiseaseFindMany.mockResolvedValue([]);
      mockDiseaseCount.mockResolvedValue(0);

      await DiseaseAnalyzerService.searchDiseases({
        symptoms: 'จุดขาว',
        page: 1,
        limit: 10,
      });

      expect(mockDiseaseFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ name: expect.any(Object) }),
            ]),
          }),
        }),
      );
    });

    it('should calculate pagination correctly', async () => {
      mockDiseaseFindMany.mockResolvedValue([]);
      mockDiseaseCount.mockResolvedValue(25);

      const result = await DiseaseAnalyzerService.searchDiseases({
        page: 2,
        limit: 10,
      });

      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.totalItems).toBe(25);
    });
  });

  describe('createDisease', () => {
    it('should create a disease with tags', async () => {
      const mockCreated = { id: 'd1', name: 'New Disease', tags: [{ label: 'tag1' }] };
      mockDiseaseCreate.mockResolvedValue(mockCreated);

      const result = await DiseaseAnalyzerService.createDisease({
        name: 'New Disease',
        category: 'ปรสิต',
        symptoms: 'symptoms text',
        tags: ['tag1'],
      });

      expect(mockDiseaseCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'New Disease',
            category: 'ปรสิต',
            symptoms: 'symptoms text',
            tags: { create: [{ label: 'tag1' }] },
          }),
        }),
      );
      expect(result).toEqual(mockCreated);
    });

    it('should create a disease without tags', async () => {
      mockDiseaseCreate.mockResolvedValue({ id: 'd1', name: 'Test', tags: [] });

      await DiseaseAnalyzerService.createDisease({
        name: 'Test',
        category: 'test',
        symptoms: 'test',
      });

      expect(mockDiseaseCreate).toHaveBeenCalled();
    });
  });

  describe('updateDisease', () => {
    it('should update disease and replace tags', async () => {
      mockDiseaseUpdate.mockResolvedValue({ id: 'd1', name: 'Updated', tags: [{ label: 'new' }] });

      await DiseaseAnalyzerService.updateDisease('d1', {
        name: 'Updated',
        tags: ['new'],
      });

      expect(mockSymptomDeleteMany).toHaveBeenCalledWith({ where: { diseaseId: 'd1' } });
      expect(mockDiseaseUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'd1' },
          data: expect.objectContaining({
            name: 'Updated',
            tags: { create: [{ label: 'new' }] },
          }),
        }),
      );
    });

    it('should update disease without touching tags when tags not provided', async () => {
      mockDiseaseUpdate.mockResolvedValue({ id: 'd1', name: 'Updated', tags: [] });

      await DiseaseAnalyzerService.updateDisease('d1', { name: 'Updated' });

      expect(mockSymptomDeleteMany).not.toHaveBeenCalled();
    });
  });

  describe('deleteDisease', () => {
    it('should delete a disease by ID', async () => {
      mockDiseaseDelete.mockResolvedValue({ id: 'd1' });

      await DiseaseAnalyzerService.deleteDisease('d1');

      expect(mockDiseaseDelete).toHaveBeenCalledWith({ where: { id: 'd1' } });
    });
  });

  describe('listAnalysisRequests', () => {
    it('should list with pagination', async () => {
      mockRequestFindMany.mockResolvedValue([]);
      mockRequestCount.mockResolvedValue(0);

      const result = await DiseaseAnalyzerService.listAnalysisRequests({
        page: 1,
        limit: 10,
      });

      expect(result.pagination.currentPage).toBe(1);
      expect(result.data).toEqual([]);
    });

    it('should filter by search text', async () => {
      mockRequestFindMany.mockResolvedValue([]);
      mockRequestCount.mockResolvedValue(0);

      await DiseaseAnalyzerService.listAnalysisRequests({
        search: 'จุดขาว',
        page: 1,
        limit: 10,
      });

      expect(mockRequestFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ symptomText: expect.any(Object) }),
            ]),
          }),
        }),
      );
    });
  });
});
