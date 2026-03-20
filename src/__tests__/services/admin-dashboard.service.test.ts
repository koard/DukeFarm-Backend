jest.mock('../../clients/prisma', () => ({
  prisma: {
    user: { count: jest.fn(), findMany: jest.fn() },
    farmerProfile: { aggregate: jest.fn(), findUnique: jest.fn() },
    farmDataEntry: { findFirst: jest.fn(), aggregate: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  },
}));

import { AdminDashboardService } from '../../services/admin-dashboard.service';
import { prisma } from '../../clients/prisma';

const mockUserCount = prisma.user.count as jest.Mock;
const mockUserFindMany = prisma.user.findMany as jest.Mock;
const mockProfileAggregate = prisma.farmerProfile.aggregate as jest.Mock;
const mockProfileFindUnique = prisma.farmerProfile.findUnique as jest.Mock;
const mockEntryFindFirst = prisma.farmDataEntry.findFirst as jest.Mock;
const mockEntryAggregate = prisma.farmDataEntry.aggregate as jest.Mock;
const mockEntryFindMany = prisma.farmDataEntry.findMany as jest.Mock;
const mockEntryCount = prisma.farmDataEntry.count as jest.Mock;

describe('AdminDashboardService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should build dashboard stats/charts/rankings', async () => {
    mockUserCount.mockResolvedValue(1);
    mockProfileAggregate.mockResolvedValue({ _sum: { declaredPondCount: 2 } });
    mockUserFindMany.mockResolvedValue([{ id: 'u1' }]);

    mockEntryFindFirst
      .mockResolvedValueOnce({ fishRemaining: 100 })
      .mockResolvedValueOnce({ recordedAt: new Date('2026-03-01T00:00:00Z') });

    mockEntryAggregate.mockResolvedValue({ _sum: { foodAmountKg: 250 } });

    mockEntryFindMany
      .mockResolvedValueOnce([{ recordedAt: new Date('2026-01-15T00:00:00Z'), foodAmountKg: 10 }])
      .mockResolvedValueOnce([
        { userId: 'u1', fishRemaining: 90, fishReleased: 100, recordedAt: new Date('2026-02-01T00:00:00Z') },
      ])
      .mockResolvedValueOnce([
        { fishRemaining: 90, fishReleased: 100, recordedAt: new Date('2026-02-01T00:00:00Z') },
      ]);

    mockProfileFindUnique.mockResolvedValue({ firstName: 'A', lastName: 'B', declaredPondCount: 2 });
    mockEntryCount.mockResolvedValue(5);

    const result = await AdminDashboardService.getDashboardStats('SMALL' as any, 2026);

    expect(result.stats.totalFarms).toBe(1);
    expect(result.stats.totalPonds).toBe(2);
    expect(result.stats.totalFish).toBe(100);
    expect(result.stats.totalFeed).toBe(250);
    expect(result.feedingChart).toHaveLength(12);
    expect(result.survivalChart).toHaveLength(12);
    expect(result.survivalRanking.length).toBeGreaterThanOrEqual(1);
    expect(result.activeRanking.length).toBeGreaterThanOrEqual(1);
  });

  it('should return zeroed stats and empty rankings when there is no data', async () => {
    mockUserCount.mockResolvedValue(0);
    mockProfileAggregate.mockResolvedValue({ _sum: { declaredPondCount: null } });
    mockUserFindMany.mockResolvedValue([]);
    mockEntryAggregate.mockResolvedValue({ _sum: { foodAmountKg: null } });
    mockEntryFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await AdminDashboardService.getDashboardStats('SMALL' as any, 2026);

    expect(result.stats).toEqual({ totalFarms: 0, totalPonds: 0, totalFish: 0, totalFeed: 0 });
    expect(result.feedingChart).toHaveLength(12);
    expect(result.survivalChart).toHaveLength(12);
    expect(result.survivalRanking).toEqual([]);
    expect(result.activeRanking).toEqual([]);
  });

  it('should use fallback logic when fishReleased is zero and profile is missing', async () => {
    mockUserCount.mockResolvedValue(1);
    mockProfileAggregate.mockResolvedValue({ _sum: { declaredPondCount: null } });
    mockUserFindMany.mockResolvedValue([{ id: 'u1' }]);

    mockEntryFindFirst
      .mockResolvedValueOnce({ fishRemaining: 20 })
      .mockResolvedValueOnce({ recordedAt: new Date('2026-03-01T00:00:00Z') });

    mockEntryAggregate.mockResolvedValue({ _sum: { foodAmountKg: null } });

    mockEntryFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { userId: 'u1', fishRemaining: 20, fishReleased: 0, recordedAt: new Date('2026-02-01T00:00:00Z') },
      ])
      .mockResolvedValueOnce([
        { fishRemaining: 20, fishReleased: 0, recordedAt: new Date('2026-02-01T00:00:00Z') },
      ]);

    mockProfileFindUnique.mockResolvedValue(null);
    mockEntryCount.mockResolvedValue(1);

    const result = await AdminDashboardService.getDashboardStats('SMALL' as any, 2026);

    expect(result.stats.totalPonds).toBe(0);
    expect(result.stats.totalFeed).toBe(0);
    expect(result.survivalRanking[0]).toMatchObject({ farm: 'Unknown', fishCount: 20 });
    expect(result.activeRanking[0]).toMatchObject({ farm: 'Unknown', totalPonds: 0, goodPonds: 1 });
  });
});
