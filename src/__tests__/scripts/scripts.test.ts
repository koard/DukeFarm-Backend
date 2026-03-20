describe('Project scripts', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('check-admin-data script should run query flow and disconnect', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const mockPrisma = {
      user: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([{ farmerProfile: { firstName: 'A' } }]),
      },
      farmerCultivationType: {
        findMany: jest.fn().mockResolvedValue([{ pondsInStage: 2 }]),
      },
      farmerProfile: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { declaredPondCount: 2 } }),
      },
      farmDataEntry: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { foodAmountKg: 100 } }),
        count: jest.fn().mockResolvedValue(3),
        findMany: jest.fn().mockResolvedValue([{ recordedAt: new Date('2026-03-20T00:00:00Z') }]),
      },
      $disconnect: jest.fn().mockResolvedValue(undefined),
    };

    jest.doMock('@prisma/client', () => ({
      PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
      FarmType: { SMALL: 'SMALL' },
    }));

    await jest.isolateModulesAsync(async () => {
      await import('../../scripts/check-admin-data');
      await new Promise((resolve) => setImmediate(resolve));
    });

    expect(mockPrisma.user.count).toHaveBeenCalled();
    expect(mockPrisma.farmDataEntry.count).toHaveBeenCalled();
    expect(mockPrisma.$disconnect).toHaveBeenCalled();

    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('check-admin-data script should log error and still disconnect on failure', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const expectedError = new Error('count failed');
    const mockPrisma = {
      user: {
        count: jest.fn().mockRejectedValue(expectedError),
        findMany: jest.fn(),
      },
      farmerCultivationType: {
        findMany: jest.fn(),
      },
      farmerProfile: {
        aggregate: jest.fn(),
      },
      farmDataEntry: {
        aggregate: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      $disconnect: jest.fn().mockResolvedValue(undefined),
    };

    jest.doMock('@prisma/client', () => ({
      PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
      FarmType: { SMALL: 'SMALL' },
    }));

    await jest.isolateModulesAsync(async () => {
      await import('../../scripts/check-admin-data');
      await new Promise((resolve) => setImmediate(resolve));
    });

    expect(errorSpy).toHaveBeenCalledWith(expectedError);
    expect(mockPrisma.$disconnect).toHaveBeenCalled();

    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('check-admin-data script should handle empty pondsInStage values', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const mockPrisma = {
      user: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([]),
      },
      farmerCultivationType: {
        findMany: jest.fn().mockResolvedValue([{ pondsInStage: undefined }, { pondsInStage: 0 }]),
      },
      farmerProfile: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { declaredPondCount: 0 } }),
      },
      farmDataEntry: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { foodAmountKg: 0 } }),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $disconnect: jest.fn().mockResolvedValue(undefined),
    };

    jest.doMock('@prisma/client', () => ({
      PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
      FarmType: { SMALL: 'SMALL' },
    }));

    await jest.isolateModulesAsync(async () => {
      await import('../../scripts/check-admin-data');
      await new Promise((resolve) => setImmediate(resolve));
    });

    expect(logSpy).toHaveBeenCalledWith('Total Ponds (cultivationTypes): 0');
    expect(mockPrisma.$disconnect).toHaveBeenCalled();

    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('verify-disease script should run analysis flow and disconnect', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const analyze = jest
      .fn()
      .mockResolvedValueOnce({ results: [{ name: 'A', score: 0.9 }] })
      .mockResolvedValueOnce({ results: [{ name: 'B', score: 0.8 }] })
      .mockResolvedValueOnce({ results: [{ name: 'C', score: 0.7 }] });

    const getSymptomChips = jest.fn().mockResolvedValue(['x', 'y']);
    const disconnect = jest.fn().mockResolvedValue(undefined);

    jest.doMock('../../services/disease-analyzer.service', () => ({
      DiseaseAnalyzerService: { analyze, getSymptomChips },
    }));

    jest.doMock('../../clients/prisma', () => ({
      prisma: { $disconnect: disconnect },
    }));

    await jest.isolateModulesAsync(async () => {
      await import('../../scripts/verify-disease');
      await new Promise((resolve) => setImmediate(resolve));
    });

    expect(analyze).toHaveBeenCalledTimes(3);
    expect(getSymptomChips).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);

    logSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
