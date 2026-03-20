import request from 'supertest';
import { createApp } from '../../app';
import { LineAuthService } from '../../services/lineAuth.service';
import { signJwt } from '../../utils/jwt';
import { LineAuthController } from '../../controllers/lineAuth.controller';

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../config/env', () => ({
  env: {
    jwtSecret: 'test-secret',
    frontendCallbackUrl: 'http://localhost:3000/auth/callback',
  },
}));

jest.mock('../../services/lineAuth.service', () => ({
  LineAuthService: {
    createLoginUrl: jest.fn(),
    handleCallback: jest.fn(),
  },
}));

jest.mock('../../clients/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    $disconnect: jest.fn(),
  },
}));

import { prisma } from '../../clients/prisma';

const mockCreateLoginUrl = LineAuthService.createLoginUrl as jest.Mock;
const mockHandleCallback = LineAuthService.handleCallback as jest.Mock;
const mockUserFindUnique = prisma.user.findUnique as jest.Mock;

describe('Line Auth Controller', () => {
  const app = createApp();
  let authToken: string;

  beforeAll(() => {
    authToken = signJwt({ sub: 'user-1', provider: 'LINE', role: 'FARMER' });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/auth/line/login', () => {
    it('should reject invalid role query', async () => {
      const response = await request(app).get('/api/auth/line/login?role=ADMIN');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid role parameter');
    });

    it('should return login url', async () => {
      mockCreateLoginUrl.mockReturnValue({ url: 'https://line.me/mock' });

      const response = await request(app).get('/api/auth/line/login?role=farmer');

      expect(response.status).toBe(200);
      expect(response.body.url).toBe('https://line.me/mock');
    });

    it('should pass RESEARCHER role when provided', async () => {
      mockCreateLoginUrl.mockReturnValue({ url: 'https://line.me/researcher' });

      const response = await request(app).get('/api/auth/line/login?role=researcher');

      expect(response.status).toBe(200);
      expect(mockCreateLoginUrl).toHaveBeenCalledWith('RESEARCHER');
    });

    it('should allow login url without role query', async () => {
      mockCreateLoginUrl.mockReturnValue({ url: 'https://line.me/no-role' });

      const response = await request(app).get('/api/auth/line/login');

      expect(response.status).toBe(200);
      expect(mockCreateLoginUrl).toHaveBeenCalledWith(undefined);
    });
  });

  describe('GET /api/auth/line/callback', () => {
    it('should return 400 when line error is present', async () => {
      const response = await request(app).get('/api/auth/line/callback?error=access_denied');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('LINE error');
    });

    it('should return 400 when code is missing', async () => {
      const response = await request(app).get('/api/auth/line/callback');

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Missing authorization code');
    });

    it('should redirect to frontend callback on success', async () => {
      mockHandleCallback.mockResolvedValue({
        token: 'jwt-token',
        user: { id: 'u1', role: 'FARMER', registrationStatus: 'COMPLETED' },
      });

      mockUserFindUnique.mockResolvedValue({
        id: 'u1',
        lineUserId: 'line-1',
        displayName: 'Farmer One',
        pictureUrl: null,
        role: 'FARMER',
        registrationStatus: 'COMPLETED',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        farmerProfile: {
          firstName: 'Farmer',
          lastName: 'One',
          phone: '0800000000',
          primaryFarmType: 'SMALL',
          declaredPondCount: 1,
          farmLatitude: 13.7,
          farmLongitude: 100.5,
          farmAreaRai: 2,
          ponds: [],
        },
        cultivationTypes: [{ farmType: 'LARGE' }],
        researcherProfile: null,
      });

      const response = await request(app).get('/api/auth/line/callback?code=abc123&state=s1');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('http://localhost:3000/auth/callback');
      expect(response.headers.location).toContain('token=jwt-token');
    });

    it('should redirect even when full user data is not found', async () => {
      mockHandleCallback.mockResolvedValue({
        token: 'jwt-token-2',
        user: { id: 'u2', role: 'RESEARCHER', registrationStatus: 'PENDING' },
      });
      mockUserFindUnique.mockResolvedValue(null);

      const response = await request(app).get('/api/auth/line/callback?code=code-2');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('role=researcher');
      expect(response.headers.location).toContain('registrationStatus=PENDING');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should require auth header', async () => {
      const response = await request(app).get('/api/auth/me');
      expect(response.status).toBe(401);
    });

    it('should return 404 when authenticated user is not found', async () => {
      mockUserFindUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('User not found');
    });

    it('should return enriched profile data', async () => {
      mockUserFindUnique.mockResolvedValue({
        id: 'user-1',
        lineUserId: 'line-1',
        displayName: 'Farmer One',
        pictureUrl: null,
        role: 'FARMER',
        registrationStatus: 'COMPLETED',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        farmerProfile: {
          firstName: 'Farmer',
          lastName: 'One',
          phone: '0800000000',
          primaryFarmType: 'SMALL',
          declaredPondCount: null,
          farmLatitude: 13.7,
          farmLongitude: 100.5,
          farmAreaRai: null,
          ponds: [],
        },
        researcherProfile: null,
        cultivationTypes: [
          { farmType: 'LARGE', cultivatedAreaRai: 1.2, pondsInStage: 3 },
          { farmType: 'SMALL', cultivatedAreaRai: 0.8, pondsInStage: 2 },
        ],
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe('user-1');
      expect(response.body.data.farmerProfile.totalFarmAreaRai).toBe(2);
      expect(response.body.data.farmerProfile.totalPondCount).toBe(5);
      expect(response.body.data.farmerProfile.farmTypes).toEqual(expect.arrayContaining(['SMALL', 'LARGE']));
    });

    it('should keep declaredPondCount and profile farmArea when available', async () => {
      mockUserFindUnique.mockResolvedValue({
        id: 'user-1',
        lineUserId: 'line-1',
        displayName: 'Farmer One',
        pictureUrl: null,
        role: 'FARMER',
        registrationStatus: 'COMPLETED',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        farmerProfile: {
          firstName: 'Farmer',
          lastName: 'One',
          phone: '0800000000',
          primaryFarmType: 'SMALL',
          declaredPondCount: 9,
          farmLatitude: 13.7,
          farmLongitude: 100.5,
          farmAreaRai: 10,
          ponds: [],
        },
        researcherProfile: null,
        cultivationTypes: [{ farmType: 'SMALL', cultivatedAreaRai: 1.2, pondsInStage: 3 }],
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.farmerProfile.totalFarmAreaRai).toBe(10);
      expect(response.body.data.farmerProfile.totalPondCount).toBe(9);
    });
  });

  it('should pass errors to next when getLineLoginUrl service throws', async () => {
    mockCreateLoginUrl.mockImplementation(() => {
      throw new Error('line login fail');
    });

    const req = { query: { role: 'farmer' } } as any;
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() } as any;
    const next = jest.fn();

    LineAuthController.getLineLoginUrl(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should pass unauthorized error to next when getMe is called without req.user', async () => {
    const req = { user: undefined } as any;
    const res = { json: jest.fn() } as any;
    const next = jest.fn();

    await LineAuthController.getMe(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401, message: 'Unauthorized' }));
  });
});
