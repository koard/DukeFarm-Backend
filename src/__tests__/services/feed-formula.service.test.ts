jest.mock('../../clients/prisma', () => ({
  prisma: {
    feedFormula: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

import { FeedFormulaService } from '../../services/feed-formula.service';
import { prisma } from '../../clients/prisma';

const mockCreate = prisma.feedFormula.create as jest.Mock;
const mockFindMany = prisma.feedFormula.findMany as jest.Mock;
const mockCount = prisma.feedFormula.count as jest.Mock;
const mockFindUnique = prisma.feedFormula.findUnique as jest.Mock;
const mockUpdate = prisma.feedFormula.update as jest.Mock;
const mockDelete = prisma.feedFormula.delete as jest.Mock;

describe('FeedFormulaService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('createFeedFormula should create and map output', async () => {
    mockCreate.mockResolvedValue({
      id: 'f1',
      name: 'สูตร 1',
      targetStage: 'S1',
      farmType: 'SMALL',
      foodType: 'PELLET',
      nutrients: null,
      usage: null,
      recommendations: null,
      ownerId: 'admin-1',
      createdAt: new Date('2026-03-20T00:00:00Z'),
      updatedAt: new Date('2026-03-20T00:00:00Z'),
    });

    const result = await FeedFormulaService.createFeedFormula({
      name: 'สูตร 1',
      targetStage: 'S1',
      farmType: 'SMALL' as any,
      foodType: 'PELLET' as any,
      createdBy: 'admin-1',
    });

    expect(result.id).toBe('f1');
    expect(result.createdBy).toBe('admin-1');
  });

  it('createFeedFormula should map nullables and fallback owner id when empty', async () => {
    mockCreate.mockResolvedValue({
      id: 'f-null',
      name: 'สูตรว่าง',
      targetStage: 'S0',
      farmType: null,
      foodType: 'PELLET',
      nutrients: null,
      usage: null,
      recommendations: null,
      ownerId: null,
      createdAt: new Date('2026-03-20T00:00:00Z'),
      updatedAt: new Date('2026-03-20T00:00:00Z'),
    });

    const result = await FeedFormulaService.createFeedFormula({
      name: 'สูตรว่าง',
      targetStage: 'S0',
      farmType: null,
      foodType: 'PELLET' as any,
      nutrients: '',
      usage: '',
      recommendations: '',
      createdBy: 'admin-x',
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        farmType: null,
        nutrients: null,
        usage: null,
        recommendations: null,
      }),
    });
    expect(result.createdBy).toBe('');
  });

  it('getFeedFormulaList should return paginated data', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'f1',
        name: 'สูตร 1',
        targetStage: 'S1',
        farmType: 'SMALL',
        foodType: 'PELLET',
        nutrients: null,
        usage: null,
        recommendations: null,
        ownerId: 'admin-1',
        createdAt: new Date('2026-03-20T00:00:00Z'),
        updatedAt: new Date('2026-03-20T00:00:00Z'),
      },
    ]);
    mockCount.mockResolvedValue(1);

    const result = await FeedFormulaService.getFeedFormulaList({ page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.pagination.totalItems).toBe(1);
  });

  it('getFeedFormulaList should apply foodType/farmType filters and map fallbacks', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'f2',
        name: 'สูตร 2',
        targetStage: null,
        farmType: null,
        foodType: 'FRESH',
        nutrients: 'x',
        usage: 'u',
        recommendations: 'r',
        ownerId: null,
        createdAt: new Date('2026-03-22T00:00:00Z'),
        updatedAt: new Date('2026-03-22T00:00:00Z'),
      },
    ]);
    mockCount.mockResolvedValue(1);

    const result = await FeedFormulaService.getFeedFormulaList({
      page: 2,
      limit: 5,
      foodType: 'FRESH' as any,
      farmType: 'LARGE' as any,
    });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { foodType: 'FRESH', farmType: 'LARGE' },
        skip: 5,
        take: 5,
      }),
    );
    expect(result.data[0]).toMatchObject({
      targetStage: '',
      createdBy: '',
    });
  });

  it('getFeedFormulaById should return null when not found', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await FeedFormulaService.getFeedFormulaById('missing');

    expect(result).toBeNull();
  });

  it('getFeedFormulaById should map formula when found with fallback owner', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'f3',
      name: 'สูตร 3',
      targetStage: 'S3',
      farmType: 'MARKET',
      foodType: 'PELLET',
      nutrients: null,
      usage: null,
      recommendations: null,
      ownerId: null,
      createdAt: new Date('2026-03-20T00:00:00Z'),
      updatedAt: new Date('2026-03-21T00:00:00Z'),
    });

    const result = await FeedFormulaService.getFeedFormulaById('f3');

    expect(result).toMatchObject({ id: 'f3', createdBy: '' });
  });

  it('updateFeedFormula should update and map output', async () => {
    mockUpdate.mockResolvedValue({
      id: 'f1',
      name: 'new',
      targetStage: 'S2',
      farmType: 'LARGE',
      foodType: 'FRESH',
      nutrients: null,
      usage: null,
      recommendations: null,
      ownerId: 'admin-1',
      createdAt: new Date('2026-03-20T00:00:00Z'),
      updatedAt: new Date('2026-03-21T00:00:00Z'),
    });

    const result = await FeedFormulaService.updateFeedFormula('f1', { name: 'new' });

    expect(result.name).toBe('new');
  });

  it('updateFeedFormula should include all optional fields and normalize empty strings', async () => {
    mockUpdate.mockResolvedValue({
      id: 'f4',
      name: 'สูตร 4',
      targetStage: 'S4',
      farmType: null,
      foodType: 'FRESH',
      nutrients: null,
      usage: null,
      recommendations: null,
      ownerId: null,
      createdAt: new Date('2026-03-20T00:00:00Z'),
      updatedAt: new Date('2026-03-21T00:00:00Z'),
    });

    const result = await FeedFormulaService.updateFeedFormula('f4', {
      targetStage: 'S4',
      farmType: null,
      foodType: 'FRESH' as any,
      nutrients: '',
      usage: '',
      recommendations: '',
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'f4' },
      data: expect.objectContaining({
        targetStage: 'S4',
        farmType: null,
        foodType: 'FRESH',
        nutrients: null,
        usage: null,
        recommendations: null,
      }),
    });
    expect(result.createdBy).toBe('');
  });

  it('updateFeedFormula should skip name and targetStage when empty strings', async () => {
    mockUpdate.mockResolvedValue({
      id: 'f5',
      name: 'still-old',
      targetStage: 'still-old',
      farmType: 'SMALL',
      foodType: 'PELLET',
      nutrients: 'n',
      usage: 'u',
      recommendations: 'r',
      ownerId: 'admin-1',
      createdAt: new Date('2026-03-20T00:00:00Z'),
      updatedAt: new Date('2026-03-21T00:00:00Z'),
    });

    await FeedFormulaService.updateFeedFormula('f5', {
      name: '',
      targetStage: '',
      foodType: undefined,
      farmType: undefined,
      nutrients: undefined,
      usage: undefined,
      recommendations: undefined,
    });

    const call = mockUpdate.mock.calls[0]?.[0];
    expect(call.data.name).toBeUndefined();
    expect(call.data.targetStage).toBeUndefined();
    expect(call.data.foodType).toBeUndefined();
    expect(call.data.farmType).toBeUndefined();
    expect(call.data.nutrients).toBeUndefined();
    expect(call.data.usage).toBeUndefined();
    expect(call.data.recommendations).toBeUndefined();
  });

  it('deleteFeedFormula should return success', async () => {
    mockDelete.mockResolvedValue({ id: 'f1' });

    const result = await FeedFormulaService.deleteFeedFormula('f1');

    expect(result.success).toBe(true);
  });
});
