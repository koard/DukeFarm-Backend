jest.mock('../../clients/prisma', () => ({
  prisma: {
    user: { findMany: jest.fn(), count: jest.fn() },
    researchSurvey: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
  },
}));

import { ResearcherService } from '../../services/researcher.service';
import { prisma } from '../../clients/prisma';

const mockUserFindMany = prisma.user.findMany as jest.Mock;
const mockUserCount = prisma.user.count as jest.Mock;
const mockSurveyFindMany = prisma.researchSurvey.findMany as jest.Mock;
const mockSurveyCount = prisma.researchSurvey.count as jest.Mock;
const mockSurveyFindUnique = prisma.researchSurvey.findUnique as jest.Mock;

describe('ResearcherService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getResearcherList should map researcher data', async () => {
    mockUserFindMany.mockResolvedValue([
      {
        id: 'r1',
        displayName: 'Fallback',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        researcherProfile: {
          firstName: 'Res',
          lastName: 'One',
          phone: '0900000000',
          organization: 'KU',
          department: 'Bio',
        },
      },
    ]);
    mockUserCount.mockResolvedValue(1);

    const result = await ResearcherService.getResearcherList({ page: 1, limit: 10 });

    expect(result.data[0].fullName).toBe('Res One');
    expect(result.pagination.totalItems).toBe(1);
  });

  it('getResearcherList should fallback to displayName or N/A when profile is missing', async () => {
    mockUserFindMany.mockResolvedValue([
      {
        id: 'r2',
        displayName: 'Display Name',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        researcherProfile: null,
      },
      {
        id: 'r3',
        displayName: '',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        researcherProfile: null,
      },
    ]);
    mockUserCount.mockResolvedValue(2);

    const result = await ResearcherService.getResearcherList({ page: 1, limit: 10 });

    expect(result.data[0]).toMatchObject({ fullName: 'Display Name', phone: '-', organization: '-', department: null });
    expect(result.data[1]).toMatchObject({ fullName: 'N/A', phone: '-', organization: '-', department: null });
  });

  it('getResearchSurveysByResearcher should map list with placeholders', async () => {
    mockSurveyFindMany.mockResolvedValue([
      {
        id: 's1',
        surveyDate: new Date('2026-01-02T00:00:00Z'),
        surveyType: 'WATER',
        createdAt: new Date('2026-01-03T00:00:00Z'),
        productionCycle: { farmType: 'SMALL' },
      },
    ]);
    mockSurveyCount.mockResolvedValue(1);

    const result = await ResearcherService.getResearchSurveysByResearcher('r1', { page: 1, limit: 10 });

    expect(result.data[0].surveyId).toBe('s1');
    expect(result.data[0].farmerName).toContain('Unknown');
  });

  it('getResearchSurveysByResearcher should fallback farmType to Unknown when missing', async () => {
    mockSurveyFindMany.mockResolvedValue([
      {
        id: 's2',
        surveyDate: new Date('2026-01-02T00:00:00Z'),
        surveyType: 'WATER',
        createdAt: new Date('2026-01-03T00:00:00Z'),
        productionCycle: { farmType: null },
      },
    ]);
    mockSurveyCount.mockResolvedValue(1);

    const result = await ResearcherService.getResearchSurveysByResearcher('r1', { page: 2, limit: 1 });

    expect(result.data[0].farmType).toBe('Unknown');
    expect(result.data[0].no).toBe(2);
  });

  it('getResearchSurveyDetail should return null when not found', async () => {
    mockSurveyFindUnique.mockResolvedValue(null);

    const result = await ResearcherService.getResearchSurveyDetail('missing');

    expect(result).toBeNull();
  });

  it('getResearchSurveyDetail should map payload fields', async () => {
    mockSurveyFindUnique.mockResolvedValue({
      id: 's1',
      surveyDate: new Date('2026-01-02T00:00:00Z'),
      surveyType: 'GENERAL',
      conductedBy: 'r1',
      partnerOrganization: 'KU',
      notes: 'ok',
      createdAt: new Date('2026-01-02T00:00:00Z'),
      updatedAt: new Date('2026-01-04T00:00:00Z'),
      dataPayload: {
        farmData: { ageRange: '30-60', pondCount: 2 },
        feedingData: { feedType: 'pellet', feedAmountKg: '20' },
        waterQuality: { temperatureC: 29, ph: 7.2 },
      },
      productionCycle: { initialStockCount: 1000 },
    });

    const result = await ResearcherService.getResearchSurveyDetail('s1');

    expect(result?.surveyId).toBe('s1');
    expect(result?.farmData.fishCount).toBe(1000);
    expect(result?.feedingData.feedType).toBe('pellet');
    expect(result?.waterQuality.temperatureC).toBe(29);
  });

  it('getResearchSurveyDetail should fallback nullable fields when payload sections are missing', async () => {
    mockSurveyFindUnique.mockResolvedValue({
      id: 's2',
      surveyDate: new Date('2026-01-02T00:00:00Z'),
      surveyType: 'GENERAL',
      conductedBy: null,
      partnerOrganization: null,
      notes: null,
      createdAt: new Date('2026-01-02T00:00:00Z'),
      updatedAt: new Date('2026-01-04T00:00:00Z'),
      dataPayload: null,
      productionCycle: { initialStockCount: 0 },
    });

    const result = await ResearcherService.getResearchSurveyDetail('s2');

    expect(result?.farmData.ageRange).toBeNull();
    expect(result?.farmData.pondCount).toBeNull();
    expect(result?.farmData.fishCount).toBeNull();
    expect(result?.feedingData.feedType).toBeNull();
    expect(result?.waterQuality.ph).toBeNull();
  });
});
