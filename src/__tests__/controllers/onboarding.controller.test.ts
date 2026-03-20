import request from 'supertest';
import { createApp } from '../../app';
import { OnboardingService } from '../../services/onboarding.service';
import { signJwt } from '../../utils/jwt';

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../config/env', () => ({
  env: { jwtSecret: 'test-secret' },
}));

jest.mock('../../services/onboarding.service', () => ({
  OnboardingService: {
    selectRole: jest.fn(),
    completeFarmerProfile: jest.fn(),
    completeResearcherProfile: jest.fn(),
  },
}));

const mockSelectRole = OnboardingService.selectRole as jest.Mock;
const mockCompleteFarmerProfile = OnboardingService.completeFarmerProfile as jest.Mock;
const mockCompleteResearcherProfile = OnboardingService.completeResearcherProfile as jest.Mock;

describe('Onboarding Controller', () => {
  const app = createApp();
  let authToken: string;

  beforeAll(() => {
    authToken = signJwt({ sub: 'user-1', provider: 'LOCAL', role: 'FARMER' });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/register/role', () => {
    it('should reject invalid role', async () => {
      const response = await request(app)
        .post('/api/register/role')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ role: 'INVALID' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('role must be either FARMER or RESEARCHER');
    });

    it('should select role successfully', async () => {
      mockSelectRole.mockResolvedValue({ role: 'FARMER' });

      const response = await request(app)
        .post('/api/register/role')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ role: 'farmer' });

      expect(response.status).toBe(200);
      expect(mockSelectRole).toHaveBeenCalledWith('user-1', 'FARMER');
    });
  });

  describe('POST /api/register/farmer', () => {
    it('should validate required ponds array', async () => {
      const response = await request(app)
        .post('/api/register/farmer')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: 'A', lastName: 'B', phone: '0800000000' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('ponds is required and must be an array');
    });

    it('should submit farmer profile successfully', async () => {
      mockCompleteFarmerProfile.mockResolvedValue({ ok: true });

      const response = await request(app)
        .post('/api/register/farmer')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'A',
          lastName: 'B',
          phone: '0800000000',
          selectedFarmTypes: ['small'],
          farmLatitude: 13.7,
          farmLongitude: 100.5,
          farmAreaRai: 2.5,
          pondsPerRai: 3,
          ponds: [
            {
              pondType: 'earthen',
              farmType: 'small',
              widthM: 10,
              lengthM: 20,
              depthM: 1.5,
            },
          ],
        });

      expect(response.status).toBe(200);
      expect(mockCompleteFarmerProfile).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          firstName: 'A',
          farmTypes: ['SMALL'],
          recordedPondCount: 1,
        }),
      );
    });

    it('should reject invalid farm latitude', async () => {
      const response = await request(app)
        .post('/api/register/farmer')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'A',
          lastName: 'B',
          phone: '0800000000',
          selectedFarmTypes: ['small'],
          farmLatitude: 999,
          farmLongitude: 100.5,
          ponds: [
            {
              pondType: 'earthen',
              farmType: 'small',
              widthM: 10,
              lengthM: 20,
              depthM: 1.5,
            },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('farmLatitude');
    });

    it('should reject invalid pond type', async () => {
      const response = await request(app)
        .post('/api/register/farmer')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'A',
          lastName: 'B',
          phone: '0800000000',
          selectedFarmTypes: ['small'],
          farmLatitude: 13.7,
          farmLongitude: 100.5,
          ponds: [
            {
              pondType: 'invalid-type',
              farmType: 'small',
              widthM: 10,
              lengthM: 20,
              depthM: 1.5,
            },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('pondType');
    });
  });

  describe('POST /api/register/researcher', () => {
    it('should submit researcher profile with optional fields', async () => {
      mockCompleteResearcherProfile.mockResolvedValue({ ok: true });

      const response = await request(app)
        .post('/api/register/researcher')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'Res',
          lastName: 'One',
          email: 'r@example.com',
          phone: '0900000000',
          organization: 'KU',
          department: '  ',
          jobTitle: '  ',
        });

      expect(response.status).toBe(200);
      expect(mockCompleteResearcherProfile).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ department: null, jobTitle: null }),
      );
    });

    it('should validate required researcher fields', async () => {
      const response = await request(app)
        .post('/api/register/researcher')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'Res',
          email: 'r@example.com',
          phone: '0900000000',
        });

      expect(response.status).toBe(400);
    });
  });
});
