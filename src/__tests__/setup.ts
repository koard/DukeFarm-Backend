// Test setup file
import { prisma } from '../clients/prisma';

beforeAll(() => {
  // Setup before all tests
  process.env.NODE_ENV = 'test';
});

afterAll(async () => {
  // Cleanup after all tests - disconnect Prisma to prevent hanging
  await prisma.$disconnect();
});
