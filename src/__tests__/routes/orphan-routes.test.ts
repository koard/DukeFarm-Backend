import express from 'express';
import request from 'supertest';
import { signJwt } from '../../utils/jwt';

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../config/env', () => ({
  env: { jwtSecret: 'test-secret' },
}));

jest.mock('../../services/onboarding.service', () => ({
  OnboardingService: {
    selectRole: jest.fn().mockResolvedValue({ role: 'FARMER' }),
    completeFarmerProfile: jest.fn().mockResolvedValue({ ok: true }),
    completeResearcherProfile: jest.fn().mockResolvedValue({ ok: true }),
  },
}));

jest.mock('../../clients/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'admin-1', role: 'ADMIN' }) },
  },
}));

describe('Orphan route modules', () => {
  it('should execute onboarding.routes module router', async () => {
    const { registerRouter } = await import('../../routes/onboarding.routes');
    const app = express();
    app.use(express.json());
    app.use('/register', registerRouter);

    const token = signJwt({ sub: 'u1', provider: 'LOCAL', role: 'FARMER' });

    const response = await request(app)
      .post('/register/role')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'FARMER' });

    expect(response.status).toBe(200);
  });

  it('should execute v1/farm.routes module router', async () => {
    const { farmRouter } = await import('../../routes/v1/farm.routes');
    const app = express();
    app.use('/v1', farmRouter);

    const token = signJwt({ sub: 'admin-1', provider: 'LOCAL', role: 'ADMIN' });

    const response = await request(app)
      .get('/v1/farms')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Protected farms resource');
  });
});
