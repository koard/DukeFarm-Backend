describe('clients/prisma', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    jest.resetModules();
    process.env.NODE_ENV = originalEnv;
  });

  it('should not auto-connect in test environment', async () => {
    process.env.NODE_ENV = 'test';

    const connect = jest.fn();
    const info = jest.fn();

    jest.doMock('@prisma/client', () => ({
      PrismaClient: jest.fn().mockImplementation(() => ({ $connect: connect })),
    }));
    jest.doMock('../../utils/logger', () => ({ logger: { info, error: jest.fn() } }));

    await jest.isolateModulesAsync(async () => {
      await import('../../clients/prisma');
    });

    expect(connect).not.toHaveBeenCalled();
  });

  it('should auto-connect and log in non-test environment', async () => {
    process.env.NODE_ENV = 'development';

    const connect = jest.fn().mockResolvedValue(undefined);
    const info = jest.fn();

    jest.doMock('@prisma/client', () => ({
      PrismaClient: jest.fn().mockImplementation(() => ({ $connect: connect })),
    }));
    jest.doMock('../../utils/logger', () => ({ logger: { info, error: jest.fn() } }));

    await jest.isolateModulesAsync(async () => {
      await import('../../clients/prisma');
    });

    expect(connect).toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith('Prisma client connected');
  });
});
