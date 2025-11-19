import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient({
  log: ['info', 'warn', 'error'],
});

const connect = async () => {
  try {
    await prisma.$connect();
    logger.info('Prisma client connected');
  } catch (error) {
    logger.error('Failed to connect Prisma client', { error });
    throw error;
  }
};

connect();

export { prisma };
