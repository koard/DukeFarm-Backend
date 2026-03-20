import request from 'supertest';
import { createApp } from '../../app';
import { ResearcherService } from '../../services/researcher.service';
import { signJwt } from '../../utils/jwt';

jest.mock('../../services/researcher.service', () => ({
  ResearcherService: {
    getResearcherList: jest.fn(),
    getResearchSurveysByResearcher: jest.fn(),
    getResearchSurveyDetail: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../config/env', () => ({
  env: { jwtSecret: 'test-secret' },
}));

jest.mock('../../clients/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    $disconnect: jest.fn(),
  },
}));

import { prisma } from '../../clients/prisma';

const mockGetResearcherList = ResearcherService.getResearcherList as jest.Mock;
const mockGetResearchSurveysByResearcher = ResearcherService.getResearchSurveysByResearcher as jest.Mock;
const mockGetResearchSurveyDetail = ResearcherService.getResearchSurveyDetail as jest.Mock;
const mockUserFindUnique = prisma.user.findUnique as jest.Mock;

describe('Researcher Controller', () => {
  const app = createApp();
  let adminToken: string;
  let researcherToken: string;

  beforeAll(() => {
    adminToken = signJwt({ sub: 'admin-id', provider: 'LOCAL', role: 'ADMIN' });
    researcherToken = signJwt({ sub: 'researcher-id', provider: 'LOCAL', role: 'RESEARCHER' });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/researchers should list researchers for ADMIN', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'admin-id', role: 'ADMIN' });
    mockGetResearcherList.mockResolvedValue({ data: [], pagination: {} });

    const response = await request(app)
      .get('/api/researchers?page=1&limit=10')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(mockGetResearcherList).toHaveBeenCalledWith({ page: 1, limit: 10 });
  });

  it('GET /api/researchers should validate pagination', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'admin-id', role: 'ADMIN' });

    const response = await request(app)
      .get('/api/researchers?page=0&limit=1000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(400);
  });

  it('GET /api/researchers/:researcherId/surveys should return surveys', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'researcher-id', role: 'RESEARCHER' });
    mockGetResearchSurveysByResearcher.mockResolvedValue({ data: [], pagination: {} });

    const response = await request(app)
      .get('/api/researchers/r1/surveys?page=1&limit=10')
      .set('Authorization', `Bearer ${researcherToken}`);

    expect(response.status).toBe(200);
    expect(mockGetResearchSurveysByResearcher).toHaveBeenCalledWith('r1', { page: 1, limit: 10 });
  });

  it('GET /api/researchers/surveys/:surveyId should return 404 when survey not found', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'researcher-id', role: 'RESEARCHER' });
    mockGetResearchSurveyDetail.mockResolvedValue(null);

    const response = await request(app)
      .get('/api/researchers/surveys/s404')
      .set('Authorization', `Bearer ${researcherToken}`);

    expect(response.status).toBe(404);
  });
});
