import request from 'supertest';
import { createApp } from '../../app';
import { DashboardService } from '../../services/dashboard.service';
import { signJwt } from '../../utils/jwt';
import { DashboardController } from '../../controllers/dashboard.controller';

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../config/env', () => ({
  env: { jwtSecret: 'test-secret' },
}));

jest.mock('../../services/dashboard.service', () => ({
  DashboardService: {
    parseFarmTypeParam: jest.fn(),
    getDashboard: jest.fn(),
  },
}));

const mockParseFarmType = DashboardService.parseFarmTypeParam as jest.Mock;
const mockGetDashboard = DashboardService.getDashboard as jest.Mock;

describe('Dashboard Controller', () => {
  const app = createApp();
  let authToken: string;

  beforeAll(() => {
    authToken = signJwt({ sub: 'user-1', provider: 'LOCAL', role: 'FARMER' });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should require authentication', async () => {
    const response = await request(app).get('/api/dashboard/groups/small');

    expect(response.status).toBe(401);
  });

  it('should return 400 when farm type is invalid', async () => {
    mockParseFarmType.mockImplementation(() => {
      throw new Error('invalid farm type');
    });

    const response = await request(app)
      .get('/api/dashboard/groups/unknown')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('invalid farm type');
  });

  it('should return dashboard data and pass query params', async () => {
    mockParseFarmType.mockReturnValue('SMALL');
    mockGetDashboard.mockResolvedValue({ totalPonds: 2 });

    const response = await request(app)
      .get('/api/dashboard/groups/small?pondId=pond-1&year=2026')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.totalPonds).toBe(2);
    expect(mockGetDashboard).toHaveBeenCalledWith('user-1', 'FARMER', 'SMALL', 'pond-1', 2026);
  });

  it('should pass unauthorized error to next when called without user', async () => {
    const req = { user: undefined, params: { groupType: 'small' }, query: {} } as any;
    const res = { json: jest.fn() } as any;
    const next = jest.fn();

    await DashboardController.getDashboardByFarmType(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401, message: 'Unauthorized' }));
  });

  it('should fallback role to empty string when role is missing', async () => {
    mockParseFarmType.mockReturnValue('SMALL');
    mockGetDashboard.mockResolvedValue({ ok: true });

    const req = {
      user: { id: 'user-1' },
      params: { groupType: 'small' },
      query: { year: 'not-a-number' },
    } as any;
    const res = { json: jest.fn() } as any;
    const next = jest.fn();

    await DashboardController.getDashboardByFarmType(req, res, next);

    expect(mockGetDashboard).toHaveBeenCalledWith('user-1', '', 'SMALL', undefined, Number.NaN);
    expect(next).not.toHaveBeenCalled();
  });

  it('should pass undefined year when year query is absent', async () => {
    mockParseFarmType.mockReturnValue('SMALL');
    mockGetDashboard.mockResolvedValue({ ok: true });

    const req = {
      user: { id: 'user-1', role: 'FARMER' },
      params: { groupType: 'small' },
      query: {},
    } as any;
    const res = { json: jest.fn() } as any;
    const next = jest.fn();

    await DashboardController.getDashboardByFarmType(req, res, next);

    expect(mockGetDashboard).toHaveBeenCalledWith('user-1', 'FARMER', 'SMALL', undefined, undefined);
    expect(next).not.toHaveBeenCalled();
  });
});
