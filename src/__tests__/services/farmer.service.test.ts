jest.mock('../../clients/prisma', () => ({
  prisma: {
    user: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    farmDataEntry: {
      groupBy: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    productionCycle: { groupBy: jest.fn(), deleteMany: jest.fn() },
    farm: { findMany: jest.fn(), deleteMany: jest.fn() },
    feedFormula: { findMany: jest.fn(), deleteMany: jest.fn() },
    farmerCultivationType: { deleteMany: jest.fn() },
    farmerProfile: { deleteMany: jest.fn() },
    researcherProfile: { deleteMany: jest.fn() },
    researchSurvey: { deleteMany: jest.fn() },
    dailyRecord: { deleteMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import { FarmerService } from '../../services/farmer.service';
import { prisma } from '../../clients/prisma';

const mockUserFindMany = prisma.user.findMany as jest.Mock;
const mockUserCount = prisma.user.count as jest.Mock;
const mockGroupBy = prisma.farmDataEntry.groupBy as jest.Mock;
const mockUserFindFirst = prisma.user.findFirst as jest.Mock;
const mockEntriesFindMany = prisma.farmDataEntry.findMany as jest.Mock;
const mockCycleGroupBy = prisma.productionCycle.groupBy as jest.Mock;
const mockTransaction = prisma.$transaction as jest.Mock;

describe('FarmerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getFarmerList should map list and pagination', async () => {
    mockUserFindMany.mockResolvedValue([
      {
        id: 'u1',
        displayName: 'Farmer One',
        pictureUrl: null,
        registrationStatus: 'COMPLETED',
        createdAt: new Date('2026-03-20T00:00:00Z'),
        farmerProfile: {
          firstName: 'A',
          lastName: 'B',
          phone: '0800000000',
          primaryFarmType: 'SMALL',
          declaredPondCount: 1,
          farmLatitude: 13.7,
          farmLongitude: 100.5,
          farmAreaRai: null,
          pondsPerRai: null,
          ponds: [],
        },
        cultivationTypes: [{ farmType: 'SMALL' }],
      },
    ]);
    mockUserCount.mockResolvedValue(1);
    mockGroupBy.mockResolvedValue([{ userId: 'u1', _count: { id: 3 }, _max: { recordedAt: new Date('2026-03-20T00:00:00Z') } }]);

    const result = await FarmerService.getFarmerList({ page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.pagination.totalItems).toBe(1);
    expect(result.data[0]?.totalRecords).toBe(3);
  });

  it('getFarmerList should apply search and farmType filters', async () => {
    mockUserFindMany.mockResolvedValue([]);
    mockUserCount.mockResolvedValue(0);
    mockGroupBy.mockResolvedValue([]);

    await FarmerService.getFarmerList({
      page: 2,
      limit: 5,
      search: 'john',
      farmType: 'LARGE' as any,
    });

    const callArg = mockUserFindMany.mock.calls[0]?.[0];
    expect(callArg.where.OR).toBeDefined();
    expect(callArg.where.cultivationTypes).toEqual({ some: { farmType: 'LARGE' } });
  });

  it('getFarmerList should map fallback fields when farmerProfile is missing', async () => {
    mockUserFindMany.mockResolvedValue([
      {
        id: 'u2',
        displayName: '',
        pictureUrl: 'img.png',
        registrationStatus: 'COMPLETED',
        createdAt: new Date('2026-03-21T00:00:00Z'),
        farmerProfile: null,
        cultivationTypes: [],
      },
    ]);
    mockUserCount.mockResolvedValue(1);
    mockGroupBy.mockResolvedValue([]);

    const result = await FarmerService.getFarmerList({ page: 1, limit: 10 });

    expect(result.data[0]).toMatchObject({
      fullName: 'N/A',
      phone: '-',
      pictureUrl: 'img.png',
      farmType: 'SMALL',
      pondCount: null,
      totalRecords: 0,
      lastRecordDate: null,
    });
  });

  it('getFarmerById should throw when missing', async () => {
    mockUserFindFirst.mockResolvedValue(null);

    await expect(FarmerService.getFarmerById('missing')).rejects.toThrow('Farmer not found');
  });

  it('getFarmerById should map stats and entries', async () => {
    mockUserFindFirst.mockResolvedValue({
      id: 'u1',
      displayName: 'Farmer One',
      pictureUrl: null,
      registrationStatus: 'COMPLETED',
      createdAt: new Date('2026-03-20T00:00:00Z'),
      farmerProfile: {
        firstName: 'A',
        lastName: 'B',
        phone: '0800000000',
        primaryFarmType: 'SMALL',
        declaredPondCount: 1,
        farmLatitude: 13.7,
        farmLongitude: 100.5,
        farmAreaRai: null,
        pondsPerRai: null,
        ponds: [{ id: 'p1', pondType: 'EARTHEN', farmType: 'SMALL', widthM: 10, lengthM: 10, depthM: 1, volumeM3: 100 }],
      },
      cultivationTypes: [{ farmType: 'SMALL' }],
    });

    mockEntriesFindMany.mockResolvedValue([
      {
        id: 'e1',
        recordedAt: new Date('2026-03-01T00:00:00Z'),
        farmType: 'SMALL',
        fishAgeDays: 10,
        fishAgeLabel: '10 วัน',
        pondType: 'EARTHEN',
        pondCount: 1,
        fishRemaining: 100,
        fishReleased: 120,
        foodAmountKg: 5,
        averageFishWeightGr: 20,
        feedFormulaName: null,
        medicineName: null,
        weatherTemperatureC: null,
        weatherRainMm: null,
        weatherHumidityPct: null,
      },
    ]);

    mockCycleGroupBy.mockResolvedValue([{ pondId: 'p1', _count: { id: 2 } }]);

    const result = await FarmerService.getFarmerById('u1');

    expect(result.userId).toBe('u1');
    expect(result.entries).toHaveLength(1);
    expect(result.ponds?.[0]?.productionCycleCount).toBe(2);
  });

  it('getFarmerById should apply explicit farmType filter and use profile fallback values', async () => {
    mockUserFindFirst.mockResolvedValue({
      id: 'u3',
      displayName: 'Fallback Name',
      pictureUrl: null,
      registrationStatus: 'COMPLETED',
      createdAt: new Date('2026-03-22T00:00:00Z'),
      farmerProfile: {
        firstName: 'C',
        lastName: 'D',
        phone: '0811111111',
        primaryFarmType: null,
        declaredPondCount: 0,
        farmLatitude: null,
        farmLongitude: null,
        farmAreaRai: null,
        pondsPerRai: null,
        ponds: [],
      },
      cultivationTypes: [{ farmType: 'LARGE' }],
    });

    mockEntriesFindMany.mockResolvedValue([]);
    mockCycleGroupBy.mockResolvedValue([]);

    const result = await FarmerService.getFarmerById('u3', 'LARGE');

    expect(mockEntriesFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u3', farmType: 'LARGE' },
      }),
    );
    expect(result.farmType).toBe('LARGE');
    expect(result.dashboardSummary.survivalRate).toBeNull();
    expect(result.dashboardSummary.releaseCount).toBeNull();
    expect(result.dashboardSummary.remainingCount).toBeNull();
  });

  it('getFarmerById should keep survival at default 100 when no valid start count exists', async () => {
    mockUserFindFirst.mockResolvedValue({
      id: 'u4',
      displayName: 'Farmer Four',
      pictureUrl: null,
      registrationStatus: 'COMPLETED',
      createdAt: new Date('2026-03-22T00:00:00Z'),
      farmerProfile: {
        firstName: 'E',
        lastName: 'F',
        phone: '0822222222',
        primaryFarmType: 'SMALL',
        declaredPondCount: 2,
        farmLatitude: null,
        farmLongitude: null,
        farmAreaRai: null,
        pondsPerRai: null,
        ponds: [],
      },
      cultivationTypes: [{ farmType: 'SMALL' }],
    });

    mockEntriesFindMany.mockResolvedValue([
      {
        id: 'e2',
        recordedAt: new Date('2026-03-10T00:00:00Z'),
        farmType: 'SMALL',
        fishAgeDays: 15,
        fishAgeLabel: '15 วัน',
        pondType: 'EARTHEN',
        pondCount: 1,
        fishRemaining: 80,
        fishReleased: 0,
        foodAmountKg: 5,
        averageFishWeightGr: null,
        feedFormulaName: null,
        medicineName: null,
        weatherTemperatureC: null,
        weatherRainMm: null,
        weatherHumidityPct: null,
      },
    ]);
    mockCycleGroupBy.mockResolvedValue([]);

    const result = await FarmerService.getFarmerById('u4');
    expect(result.stats.survivalRatePct).toBe(100);
    expect(result.dashboardSummary.avgWeight).toBeNull();
  });

  it('getFarmerById should support ALL filter mode', async () => {
    mockUserFindFirst.mockResolvedValue({
      id: 'u1',
      displayName: 'Farmer One',
      pictureUrl: null,
      registrationStatus: 'COMPLETED',
      createdAt: new Date('2026-03-20T00:00:00Z'),
      farmerProfile: {
        firstName: 'A',
        lastName: 'B',
        phone: '0800000000',
        primaryFarmType: 'SMALL',
        declaredPondCount: 1,
        farmLatitude: 13.7,
        farmLongitude: 100.5,
        farmAreaRai: null,
        pondsPerRai: null,
        ponds: [],
      },
      cultivationTypes: [{ farmType: 'SMALL' }],
    });
    mockEntriesFindMany.mockResolvedValue([]);
    mockCycleGroupBy.mockResolvedValue([]);

    const result = await FarmerService.getFarmerById('u1', 'ALL');
    expect(result.availableFarmTypes).toEqual(['SMALL']);
  });

  it('deleteFarmerById should reject non-farmer accounts', async () => {
    mockTransaction.mockImplementation(async (cb: any) => {
      const tx = {
        user: { findUnique: jest.fn().mockResolvedValue({ role: 'ADMIN' }) },
      };
      return cb(tx);
    });

    await expect(FarmerService.deleteFarmerById('u1')).rejects.toThrow(
      'Only farmer accounts can be deleted via this endpoint',
    );
  });

  it('deleteFarmerById should throw when user not found', async () => {
    mockTransaction.mockImplementation(async (cb: any) => {
      const tx = {
        user: { findUnique: jest.fn().mockResolvedValue(null) },
      };
      return cb(tx);
    });

    await expect(FarmerService.deleteFarmerById('not-found')).rejects.toThrow('Farmer not found');
  });

  it('deleteFarmerById should execute cleanup transaction for farmer account', async () => {
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ role: 'FARMER' }),
        delete: jest.fn().mockResolvedValue({ id: 'u1' }),
      },
      farm: {
        findMany: jest.fn().mockResolvedValue([{ id: 'farm-1' }]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      researchSurvey: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      dailyRecord: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      productionCycle: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      feedFormula: {
        findMany: jest.fn().mockResolvedValue([{ id: 'ff-1' }]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      farmDataEntry: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
      farmerCultivationType: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      farmerProfile: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      researcherProfile: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    } as any;

    mockTransaction.mockImplementation(async (cb: any) => cb(tx));

    await FarmerService.deleteFarmerById('u1');

    expect(tx.feedFormula.deleteMany).toHaveBeenCalled();
    expect(tx.farm.deleteMany).toHaveBeenCalled();
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
  });

  it('deleteFarmerById should skip farm/feedformula deletes when nothing is linked', async () => {
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ role: 'FARMER' }),
        delete: jest.fn().mockResolvedValue({ id: 'u2' }),
      },
      farm: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      researchSurvey: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      dailyRecord: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      productionCycle: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      feedFormula: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      farmDataEntry: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      farmerCultivationType: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      farmerProfile: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      researcherProfile: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    } as any;

    mockTransaction.mockImplementation(async (cb: any) => cb(tx));

    await FarmerService.deleteFarmerById('u2');

    expect(tx.feedFormula.deleteMany).not.toHaveBeenCalled();
    expect(tx.farm.deleteMany).not.toHaveBeenCalled();
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: 'u2' } });
  });
});
