const mockProductionCycle = {
  findFirst: jest.fn(),
  update: jest.fn(),
  findMany: jest.fn(),
  count: jest.fn(),
  create: jest.fn(),
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    productionCycle: mockProductionCycle,
  })),
  ProductionCycleStatus: {
    PLANNING: 'PLANNING',
    STOCKING: 'STOCKING',
    GROWOUT: 'GROWOUT',
    HARVEST_READY: 'HARVEST_READY',
    HARVESTED: 'HARVESTED',
  },
  FarmType: {
    SMALL: 'SMALL',
    LARGE: 'LARGE',
    MARKET: 'MARKET',
  },
}));

import { PondService } from '../../services/pond.service';

describe('PondService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getActiveCycle should query active statuses', async () => {
    mockProductionCycle.findFirst.mockResolvedValue({ id: 'c1' });

    const result = await PondService.getActiveCycle('pond-1');

    expect(result?.id).toBe('c1');
    expect(mockProductionCycle.findFirst).toHaveBeenCalled();
  });

  it('closeActiveCycle should throw when no active cycle', async () => {
    mockProductionCycle.findFirst.mockResolvedValue(null);

    await expect(PondService.closeActiveCycle('pond-1')).rejects.toThrow(
      'No active production cycle found for this pond',
    );
  });

  it('closeActiveCycle should update status to HARVESTED', async () => {
    mockProductionCycle.findFirst.mockResolvedValue({ id: 'active-1' });
    mockProductionCycle.update.mockResolvedValue({ id: 'active-1', status: 'HARVESTED' });

    const result = await PondService.closeActiveCycle('pond-1');

    expect(result.status).toBe('HARVESTED');
    expect(mockProductionCycle.update).toHaveBeenCalled();
  });

  it('listCycles and countCycles should return data', async () => {
    mockProductionCycle.findMany.mockResolvedValue([{ id: 'c1' }]);
    mockProductionCycle.count.mockResolvedValue(3);

    const list = await PondService.listCycles('pond-1');
    const count = await PondService.countCycles('pond-1');

    expect(list).toHaveLength(1);
    expect(count).toBe(3);
  });

  it('startNewCycle should close existing cycle then create new one', async () => {
    mockProductionCycle.findFirst.mockResolvedValue({ id: 'active-1' });
    mockProductionCycle.update.mockResolvedValue({ id: 'active-1', status: 'HARVESTED' });
    mockProductionCycle.create.mockResolvedValue({ id: 'new-cycle', status: 'PLANNING' });

    const result = await PondService.startNewCycle('pond-1', 'SMALL' as any);

    expect(mockProductionCycle.update).toHaveBeenCalled();
    expect(mockProductionCycle.create).toHaveBeenCalled();
    expect(result.id).toBe('new-cycle');
  });
});
