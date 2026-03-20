jest.mock('../../clients/prisma', () => ({
  prisma: {
    fishAgeStage: { findFirst: jest.fn() },
  },
}));

import { FishStageService } from '../../services/fish-stage.service';
import { prisma } from '../../clients/prisma';

const mockFindStage = prisma.fishAgeStage.findFirst as jest.Mock;

describe('FishStageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('estimateDaysFromLabel should parse ranges and open ended labels', () => {
    expect(FishStageService.estimateDaysFromLabel('30-45 วัน')).toBe(45);
    expect(FishStageService.estimateDaysFromLabel('>60 วัน')).toBe(60);
    expect(FishStageService.estimateDaysFromLabel('ไม่มีตัวเลข')).toBeNull();
  });

  it('assessFishStage should return unknown when age cannot be determined', async () => {
    const result = await FishStageService.assessFishStage({
      farmType: 'SMALL' as any,
      recordedAt: new Date('2026-01-01T00:00:00Z'),
      fishAgeLabel: 'n/a',
      productionCycleStartDate: null,
    });

    expect(result.fishAgeDays).toBeNull();
    expect(result.harvestStatus).toBe('UNKNOWN');
  });

  it('assessFishStage should return TOO_EARLY when below harvest window', async () => {
    mockFindStage.mockResolvedValue({
      displayName: 'Stage A',
      harvestStartDay: 60,
      harvestEndDay: 90,
    });

    const result = await FishStageService.assessFishStage({
      farmType: 'SMALL' as any,
      recordedAt: new Date('2026-02-01T00:00:00Z'),
      productionCycleStartDate: new Date('2026-01-15T00:00:00Z'),
      fishAgeLabel: 'ignored',
    });

    expect(result.harvestStatus).toBe('TOO_EARLY');
  });

  it('assessFishStage should return OPTIMAL for in-window age', async () => {
    mockFindStage.mockResolvedValue({
      displayName: 'Stage B',
      harvestStartDay: 10,
      harvestEndDay: 30,
    });

    const result = await FishStageService.assessFishStage({
      farmType: 'LARGE' as any,
      recordedAt: new Date('2026-01-21T00:00:00Z'),
      productionCycleStartDate: new Date('2026-01-01T00:00:00Z'),
      fishAgeLabel: 'ignored',
    });

    expect(result.harvestStatus).toBe('OPTIMAL');
  });

  it('assessFishStage should return LATE when above harvest window', async () => {
    mockFindStage.mockResolvedValue({
      displayName: 'Stage C',
      harvestStartDay: 10,
      harvestEndDay: 20,
    });

    const result = await FishStageService.assessFishStage({
      farmType: 'MARKET' as any,
      recordedAt: new Date('2026-02-10T00:00:00Z'),
      productionCycleStartDate: new Date('2026-01-01T00:00:00Z'),
      fishAgeLabel: 'ignored',
    });

    expect(result.harvestStatus).toBe('LATE');
  });
});
