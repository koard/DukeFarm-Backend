import request from 'supertest';
import crypto from 'crypto';
import { createApp } from '../../app';

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../config/env', () => ({
  env: { jwtSecret: 'test-secret' },
}));

jest.mock('../../clients/prisma', () => ({
  prisma: {
    researcherProfile: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import { prisma } from '../../clients/prisma';

const mockFindFirst = prisma.researcherProfile.findFirst as jest.Mock;
const mockTransaction = prisma.$transaction as jest.Mock;

describe('Admin Controller', () => {
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/admin/login', () => {
    it('should return 400 when email/password are missing', async () => {
      const response = await request(app).post('/api/auth/admin/login').send({ email: '' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Email and password are required');
    });

    it('should return 401 when profile is not found', async () => {
      mockFindFirst.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/admin/login')
        .send({ email: 'admin@example.com', password: 'secret' });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid email or password');
    });

    it('should return 403 for non-admin user', async () => {
      mockFindFirst.mockResolvedValue({
        firstName: 'A',
        lastName: 'B',
        email: 'admin@example.com',
        user: {
          id: 'u1',
          role: 'FARMER',
          passwordHash: 'hash',
          displayName: null,
          registrationStatus: 'COMPLETED',
        },
      });

      const response = await request(app)
        .post('/api/auth/admin/login')
        .send({ email: 'admin@example.com', password: 'secret' });

      expect(response.status).toBe(403);
    });

    it('should return 200 and token for valid admin credentials', async () => {
      const password = 'secret123';
      const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

      mockFindFirst.mockResolvedValue({
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@example.com',
        user: {
          id: 'u-admin',
          role: 'ADMIN',
          passwordHash: hashedPassword,
          displayName: null,
          registrationStatus: 'COMPLETED',
        },
      });

      const response = await request(app)
        .post('/api/auth/admin/login')
        .send({ email: 'admin@example.com', password });

      expect(response.status).toBe(200);
      expect(response.body.data.user.id).toBe('u-admin');
      expect(response.body.data.token).toBeTruthy();
    });
  });

  describe('POST /api/auth/admin/create', () => {
    it('should return 400 when required fields are missing', async () => {
      const response = await request(app)
        .post('/api/auth/admin/create')
        .send({ email: 'admin@example.com' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('All fields are required');
    });

    it('should return 409 when email already exists', async () => {
      mockFindFirst.mockResolvedValue({ id: 'existing-profile' });

      const response = await request(app)
        .post('/api/auth/admin/create')
        .send({
          email: 'admin@example.com',
          password: 'secret123',
          firstName: 'Admin',
          lastName: 'User',
          phone: '0800000000',
          organization: 'DukeFarm',
        });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe('Email already exists');
    });

    it('should create admin successfully', async () => {
      mockFindFirst.mockResolvedValue(null);

      mockTransaction.mockImplementation(async (cb: any) => {
        const tx = {
          user: {
            create: jest.fn().mockResolvedValue({
              id: 'new-admin',
              displayName: 'Admin User',
              role: 'ADMIN',
            }),
          },
          researcherProfile: {
            create: jest.fn().mockResolvedValue({
              email: 'admin@example.com',
            }),
          },
        };
        return cb(tx);
      });

      const response = await request(app)
        .post('/api/auth/admin/create')
        .send({
          email: 'admin@example.com',
          password: 'secret123',
          firstName: 'Admin',
          lastName: 'User',
          phone: '0800000000',
          organization: 'DukeFarm',
          department: 'IT',
          jobTitle: 'Lead',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.id).toBe('new-admin');
      expect(response.body.data.role).toBe('ADMIN');
    });
  });
});
