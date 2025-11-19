import os from 'os';
import { prisma } from '../clients/prisma';
import { logger } from '../utils/logger';

const getHealthStatus = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'ok',
      database: 'connected',
      uptimeSeconds: process.uptime(),
      host: os.hostname(),
    };
  } catch (error) {
    logger.error('Database connectivity check failed', { error });
    return {
      status: 'degraded',
      database: 'unreachable',
      uptimeSeconds: process.uptime(),
      host: os.hostname(),
    };
  }
};

export const HealthService = {
  getHealthStatus,
};
