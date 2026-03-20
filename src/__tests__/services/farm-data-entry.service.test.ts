jest.mock('../../clients/prisma', () => ({
  prisma: {
    farmerProfile: { findUnique: jest.fn() },
    farmDataEntry: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    farmerCultivationType: { upsert: jest.fn() },
    productionCycle: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
    pond: { findUnique: jest.fn(), update: jest.fn() },
  },
}));

jest.mock('../../services/weather.service', () => ({
  WeatherService: { getCurrentWeather: jest.fn() },
}));

jest.mock('../../services/fish-stage.service', () => ({
  FishStageService: { assessFishStage: jest.fn() },
}));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { FarmDataEntryService } from '../../services/farm-data-entry.service';
import { prisma } from '../../clients/prisma';
import { WeatherService } from '../../services/weather.service';
import { FishStageService } from '../../services/fish-stage.service';

const mockFarmerProfile = prisma.farmerProfile.findUnique as jest.Mock;
const mockFindFirst = prisma.farmDataEntry.findFirst as jest.Mock;
const mockCreate = prisma.farmDataEntry.create as jest.Mock;
const mockFindUnique = prisma.farmDataEntry.findUnique as jest.Mock;
const mockUpdate = prisma.farmDataEntry.update as jest.Mock;
const mockDelete = prisma.farmDataEntry.delete as jest.Mock;
const mockFindMany = prisma.farmDataEntry.findMany as jest.Mock;
const mockCount = prisma.farmDataEntry.count as jest.Mock;
const mockCultivationUpsert = prisma.farmerCultivationType.upsert as jest.Mock;
const mockCycleFindFirst = prisma.productionCycle.findFirst as jest.Mock;
const mockCycleUpdate = prisma.productionCycle.update as jest.Mock;
const mockCycleCreate = prisma.productionCycle.create as jest.Mock;
const mockPondFindUnique = prisma.pond.findUnique as jest.Mock;
const mockPondUpdate = prisma.pond.update as jest.Mock;
const mockGetCurrentWeather = WeatherService.getCurrentWeather as jest.Mock;
const mockAssessStage = FishStageService.assessFishStage as jest.Mock;

describe('FarmDataEntryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getFormState should return weather and latest entry', async () => {
    mockFarmerProfile.mockResolvedValue({ farmLatitude: 13.7, farmLongitude: 100.5 });
    mockGetCurrentWeather.mockResolvedValue({
      time: '2026-03-20T00:00:00Z',
      temperatureC: 30,
      rainMm: 0,
      humidityPct: 70,
      conditionText: 'Clear',
      weatherCode: 1,
    });
    mockFindFirst.mockResolvedValue({
      recordedAt: new Date('2026-03-19T00:00:00Z'),
      fishAgeDays: 30,
      fishRemaining: 900,
    });

    const result = await FarmDataEntryService.getFormState('u1', 'SMALL' as any);

    expect(result.locationAvailable).toBe(true);
    expect(result.weather?.temperatureC).toBe(30);
    expect(result.latestEntry?.fishRemaining).toBe(900);
  });

  it('getFormState should return null weather when location missing', async () => {
    mockFarmerProfile.mockResolvedValue({ farmLatitude: null, farmLongitude: null });
    mockFindFirst.mockResolvedValue(null);

    const result = await FarmDataEntryService.getFormState('u1', 'SMALL' as any);

    expect(result.locationAvailable).toBe(false);
    expect(result.weather).toBeNull();
    expect(result.latestEntry).toBeNull();
  });

  it('getFormState should handle weather fetch errors gracefully', async () => {
    mockFarmerProfile.mockResolvedValue({ farmLatitude: 13.7, farmLongitude: 100.5 });
    mockGetCurrentWeather.mockRejectedValue(new Error('weather down'));
    mockFindFirst.mockResolvedValue(null);

    const result = await FarmDataEntryService.getFormState('u1', 'SMALL' as any);

    expect(result.locationAvailable).toBe(true);
    expect(result.weather).toBeNull();
  });

  it('createEntry should create new cycle and persist record', async () => {
    mockCultivationUpsert.mockResolvedValue({ id: 'cult-1' });
    mockAssessStage.mockResolvedValue({
      fishAgeDays: 40,
      stage: { id: 'stage-1' },
      harvestStatus: 'TOO_EARLY',
      harvestStatusReason: 'early',
    });
    mockCycleFindFirst.mockResolvedValue(null);
    mockCycleCreate.mockResolvedValue({ id: 'cycle-1' });
    mockPondFindUnique.mockResolvedValue({ farmType: 'LARGE' });
    mockPondUpdate.mockResolvedValue({ id: 'pond-1' });
    mockCreate.mockResolvedValue({ id: 'entry-1' });

    const result = await FarmDataEntryService.createEntry('u1', {
      farmType: 'SMALL' as any,
      recordedAt: new Date('2026-03-20T00:00:00Z'),
      fishAgeLabel: '30-45 วัน',
      pondId: 'pond-1',
      fishReleased: 1000,
      fishRemaining: 980,
      averageFishWeightGr: 50,
      foodAmountKg: 20,
      weather: { temperatureC: 30, rainMm: 0, humidityPct: 70 },
    });

    expect(mockCycleCreate).toHaveBeenCalled();
    expect(mockPondUpdate).toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalled();
    expect(result.id).toBe('entry-1');
  });

  it('createEntry should update planning cycle and avoid pond update when farmType matches', async () => {
    mockCultivationUpsert.mockResolvedValue({ id: 'cult-1' });
    mockAssessStage.mockResolvedValue({
      fishAgeDays: 20,
      stage: { id: 'stage-1' },
      harvestStatus: 'UNKNOWN',
      harvestStatusReason: 'x',
    });

    mockCycleFindFirst.mockResolvedValue({ id: 'cycle-1', status: 'PLANNING' });
    mockCycleUpdate.mockResolvedValue({ id: 'cycle-1' });
    mockPondFindUnique.mockResolvedValue({ farmType: 'SMALL' });
    mockCreate.mockResolvedValue({ id: 'entry-2' });

    const result = await FarmDataEntryService.createEntry('u1', {
      farmType: 'SMALL' as any,
      recordedAt: new Date('2026-03-20T00:00:00Z'),
      fishAgeLabel: '20 วัน',
      pondId: 'pond-1',
      fishReleased: 100,
      fishRemaining: 95,
      averageFishWeightGr: 20,
    });

    expect(mockCycleUpdate).toHaveBeenCalled();
    expect(mockPondUpdate).not.toHaveBeenCalled();
    expect(result.id).toBe('entry-2');
  });

  it('updateEntry should throw 404 when entry not found', async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(FarmDataEntryService.updateEntry('missing', { notes: 'x' })).rejects.toThrow('Record not found');
  });

  it('updateEntry should recalculate fish stage and weather fields', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'e1',
      farmType: 'SMALL',
      recordedAt: new Date('2026-03-19T00:00:00Z'),
    });
    mockAssessStage.mockResolvedValue({
      fishAgeDays: 41,
      stage: { id: 'stage-2' },
      harvestStatus: 'OPTIMAL',
      harvestStatusReason: 'ok',
    });
    mockUpdate.mockResolvedValue({ id: 'e1' });

    const result = await FarmDataEntryService.updateEntry('e1', {
      fishAgeLabel: '41 วัน',
      weather: { temperatureC: 30, rainMm: 0, humidityPct: 70 },
      fishReleased: 100,
      fishRemaining: 99,
    });

    expect(mockAssessStage).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalled();
    expect(result.id).toBe('e1');
  });

  it('updateEntry should handle nullable pondType/pondCount and numeric cleanup', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'e2',
      farmType: 'SMALL',
      recordedAt: new Date('2026-03-19T00:00:00Z'),
    });
    mockUpdate.mockResolvedValue({ id: 'e2' });

    const result = await FarmDataEntryService.updateEntry('e2', {
      pondType: null,
      pondCount: Number.NaN,
      foodAmountKg: Number.NaN,
      fishReleased: Number.NaN,
      fishRemaining: Number.NaN,
      notes: 'ok',
    });

    expect(mockUpdate).toHaveBeenCalled();
    expect(result.id).toBe('e2');
  });

  it('getUserEntries/getEntryById/deleteEntry should map and return data', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'e1',
        farmType: 'SMALL',
        pondId: 'p1',
        pond: { id: 'p1', pondType: 'EARTHEN', farmType: 'SMALL' },
        recordedAt: new Date('2026-03-20T00:00:00Z'),
        fishAgeLabel: '30-45 วัน',
        fishAgeDays: 40,
        fishReleased: 1000,
        fishRemaining: 900,
        averageFishWeightGr: 55,
        feedFormulaName: null,
        medicineName: null,
        foodAmountKg: 20,
        foodCostBaht: 100,
        medicineCostBaht: 0,
        pondType: 'EARTHEN',
        pondCount: 1,
        weatherTemperatureC: 30,
        weatherRainMm: 0,
        weatherHumidityPct: 70,
        notes: null,
        createdAt: new Date('2026-03-20T00:00:00Z'),
      },
    ]);
    mockCount.mockResolvedValue(1);
    mockFindUnique.mockResolvedValue({
      id: 'e1',
      farmType: 'SMALL',
      pondId: 'p1',
      pond: { id: 'p1', pondType: 'EARTHEN', farmType: 'SMALL', widthM: 1, lengthM: 1, depthM: 1 },
      recordedAt: new Date('2026-03-20T00:00:00Z'),
      fishAgeLabel: '30-45 วัน',
      fishAgeDays: 40,
      fishReleased: 1000,
      fishRemaining: 900,
      averageFishWeightGr: 55,
      foodAmountKg: 20,
      feedFormulaName: null,
      supplementName: null,
      medicineName: null,
      foodCostBaht: 100,
      medicineCostBaht: 0,
      pondType: 'EARTHEN',
      pondCount: 1,
      weatherTemperatureC: 30,
      weatherRainMm: 0,
      weatherHumidityPct: 70,
      notes: null,
      createdAt: new Date('2026-03-20T00:00:00Z'),
    });
    mockDelete.mockResolvedValue({ id: 'e1' });

    const list = await FarmDataEntryService.getUserEntries('u1', undefined, 'SMALL' as any, 1, 20);
    const detail = await FarmDataEntryService.getEntryById('e1');
    const deleted = await FarmDataEntryService.deleteEntry('e1');

    expect(list.data).toHaveLength(1);
    expect(detail?.id).toBe('e1');
    expect(deleted.id).toBe('e1');
  });

  it('getEntryById should return null for unknown id', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await FarmDataEntryService.getEntryById('missing');

    expect(result).toBeNull();
  });

  it('getUserEntries should apply all optional filters', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await FarmDataEntryService.getUserEntries(
      'u1',
      'pond-1',
      'SMALL' as any,
      2,
      5,
      'cycle-1',
      '2026-01-01T00:00:00Z',
      '2026-12-31T00:00:00Z',
    );

    const whereArg = mockFindMany.mock.calls[mockFindMany.mock.calls.length - 1]?.[0]?.where;
    expect(whereArg.pondId).toBe('pond-1');
    expect(whereArg.farmType).toBe('SMALL');
    expect(whereArg.productionCycleId).toBe('cycle-1');
    expect(whereArg.recordedAt.gte).toBeInstanceOf(Date);
    expect(whereArg.recordedAt.lte).toBeInstanceOf(Date);
  });
});
