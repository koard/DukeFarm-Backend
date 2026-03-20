import request from 'supertest';
import { createApp } from '../../app';
import { FarmDataEntryService } from '../../services/farm-data-entry.service';
import { signJwt } from '../../utils/jwt';
import { RecordController } from '../../controllers/record.controller';

jest.mock('../../services/farm-data-entry.service', () => ({
  FarmDataEntryService: {
    getFormState: jest.fn(),
    getUserEntries: jest.fn(),
    createEntry: jest.fn(),
    updateEntry: jest.fn(),
    deleteEntry: jest.fn(),
    getEntryById: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../config/env', () => ({
  env: { jwtSecret: 'test-secret' },
}));

const mockGetFormState = FarmDataEntryService.getFormState as jest.Mock;
const mockGetUserEntries = FarmDataEntryService.getUserEntries as jest.Mock;
const mockCreateEntry = FarmDataEntryService.createEntry as jest.Mock;
const mockUpdateEntry = FarmDataEntryService.updateEntry as jest.Mock;
const mockDeleteEntry = FarmDataEntryService.deleteEntry as jest.Mock;
const mockGetEntryById = FarmDataEntryService.getEntryById as jest.Mock;

describe('Record Controller', () => {
  const app = createApp();
  let farmerToken: string;
  let adminToken: string;

  beforeAll(() => {
    farmerToken = signJwt({ sub: 'farmer-1', provider: 'LOCAL', role: 'FARMER' });
    adminToken = signJwt({ sub: 'admin-1', provider: 'LOCAL', role: 'ADMIN' });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/records/form-state should validate farmType', async () => {
    const response = await request(app)
      .get('/api/records/form-state')
      .set('Authorization', `Bearer ${farmerToken}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('farmType is required');
  });

  it('GET /api/records/form-state should return data', async () => {
    mockGetFormState.mockResolvedValue({ defaultPondCount: 1 });

    const response = await request(app)
      .get('/api/records/form-state?farmType=small')
      .set('Authorization', `Bearer ${farmerToken}`);

    expect(response.status).toBe(200);
    expect(mockGetFormState).toHaveBeenCalledWith('farmer-1', 'SMALL');
  });

  it('GET /api/records/form-state should reject unsupported farmType', async () => {
    const response = await request(app)
      .get('/api/records/form-state?farmType=bad-type')
      .set('Authorization', `Bearer ${farmerToken}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Unsupported farmType');
  });

  it('GET /api/records should pass query params and admin override userId', async () => {
    mockGetUserEntries.mockResolvedValue({ data: [], pagination: { currentPage: 1 } });

    const response = await request(app)
      .get('/api/records?userId=farmer-x&farmType=SMALL&page=2&limit=30')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(mockGetUserEntries).toHaveBeenCalledWith('farmer-x', undefined, 'SMALL', 2, 30, undefined, undefined, undefined);
  });

  it('GET /api/records should reject invalid farmType', async () => {
    const response = await request(app)
      .get('/api/records?farmType=NOT_VALID')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Invalid farmType');
  });

  it('GET /api/records should ignore userId override for farmer role', async () => {
    mockGetUserEntries.mockResolvedValue({ data: [], pagination: { currentPage: 1 } });

    const response = await request(app)
      .get('/api/records?userId=farmer-x')
      .set('Authorization', `Bearer ${farmerToken}`);

    expect(response.status).toBe(200);
    expect(mockGetUserEntries).toHaveBeenCalledWith('farmer-1', undefined, undefined, 1, 20, undefined, undefined, undefined);
  });

  it('GET /api/records should clamp page and limit and pass date filters', async () => {
    mockGetUserEntries.mockResolvedValue({ data: [], pagination: { currentPage: 1 } });

    const response = await request(app)
      .get('/api/records?pondId=p-1&productionCycleId=pc-1&startDate=2026-01-01&endDate=2026-01-31&page=0&limit=999')
      .set('Authorization', `Bearer ${farmerToken}`);

    expect(response.status).toBe(200);
    expect(mockGetUserEntries).toHaveBeenCalledWith('farmer-1', 'p-1', undefined, 1, 100, 'pc-1', '2026-01-01', '2026-01-31');
  });

  it('POST /api/records should block non-farmer', async () => {
    const response = await request(app)
      .post('/api/records')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(response.status).toBe(403);
  });

  it('POST /api/records should validate required fields', async () => {
    const response = await request(app)
      .post('/api/records')
      .set('Authorization', `Bearer ${farmerToken}`)
      .send({ farmType: 'SMALL' });

    expect(response.status).toBe(400);
  });

  it('POST /api/records should create record', async () => {
    mockCreateEntry.mockResolvedValue({ id: 'rec-1' });

    const response = await request(app)
      .post('/api/records')
      .set('Authorization', `Bearer ${farmerToken}`)
      .send({
        farmType: 'SMALL',
        recordedAt: '2026-03-20T00:00:00Z',
        fishAgeLabel: '30-45 วัน',
        pondType: 'EARTHEN',
        pondCount: 1,
        fishRemaining: 1000,
        foodAmountKg: 20,
        weather: { temperatureC: 30, rainMm: 0, humidityPct: 70 },
      });

    expect(response.status).toBe(201);
    expect(response.body.data.id).toBe('rec-1');
  });

  it('POST /api/records should validate weather numeric fields', async () => {
    const response = await request(app)
      .post('/api/records')
      .set('Authorization', `Bearer ${farmerToken}`)
      .send({
        farmType: 'SMALL',
        recordedAt: '2026-03-20T00:00:00Z',
        fishAgeLabel: '30-45 วัน',
        weather: { temperatureC: 'abc' },
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('weather.temperatureC');
  });

  it('POST /api/records should validate invalid recordedAt format', async () => {
    const response = await request(app)
      .post('/api/records')
      .set('Authorization', `Bearer ${farmerToken}`)
      .send({
        farmType: 'SMALL',
        recordedAt: 'not-a-date',
        fishAgeLabel: '30-45 วัน',
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('recordedAt is invalid');
  });

  it('POST /api/records should validate unsupported pondType', async () => {
    const response = await request(app)
      .post('/api/records')
      .set('Authorization', `Bearer ${farmerToken}`)
      .send({
        farmType: 'SMALL',
        recordedAt: '2026-03-20T00:00:00Z',
        fishAgeLabel: '30-45 วัน',
        pondType: 'unknown',
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Unsupported pondType');
  });

  it('POST /api/records should validate negative numeric fields', async () => {
    const response = await request(app)
      .post('/api/records')
      .set('Authorization', `Bearer ${farmerToken}`)
      .send({
        farmType: 'SMALL',
        recordedAt: '2026-03-20T00:00:00Z',
        fishAgeLabel: '30-45 วัน',
        foodAmountKg: -1,
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('foodAmountKg must be zero or greater');
  });

  it('PUT /api/records/:id should update record', async () => {
    mockUpdateEntry.mockResolvedValue({ id: 'rec-1', notes: 'updated' });

    const response = await request(app)
      .put('/api/records/rec-1')
      .set('Authorization', `Bearer ${farmerToken}`)
      .send({ notes: 'updated', foodAmountKg: 30 });

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe('rec-1');
  });

  it('PUT /api/records/:id should trim fishAgeLabel and map weather payload', async () => {
    mockUpdateEntry.mockResolvedValue({ id: 'rec-1' });

    const response = await request(app)
      .put('/api/records/rec-1')
      .set('Authorization', `Bearer ${farmerToken}`)
      .send({
        fishAgeLabel: '  46-60 วัน  ',
        pondType: 'EARTHEN',
        pondCount: 5,
        fishReleased: 2000,
        fishRemaining: 1800,
        foodAmountKg: 33,
        notes: 'x',
        weather: { rainMm: 2 },
      });

    expect(response.status).toBe(200);
    expect(mockUpdateEntry).toHaveBeenCalledWith(
      'rec-1',
      expect.objectContaining({
        fishAgeLabel: '46-60 วัน',
        pondType: 'EARTHEN',
        pondCount: 5,
        fishReleased: 2000,
        fishRemaining: 1800,
        foodAmountKg: 33,
        notes: 'x',
        weather: {
          temperatureC: null,
          rainMm: 2,
          humidityPct: null,
        },
      }),
    );
  });

  it('PUT /api/records/:id should validate update recordedAt and numeric fields', async () => {
    const invalidDate = await request(app)
      .put('/api/records/rec-1')
      .set('Authorization', `Bearer ${farmerToken}`)
      .send({ recordedAt: 'invalid' });

    expect(invalidDate.status).toBe(400);
    expect(invalidDate.body.message).toBe('recordedAt is invalid');

    const negativePondCount = await request(app)
      .put('/api/records/rec-1')
      .set('Authorization', `Bearer ${farmerToken}`)
      .send({ pondCount: -1 });

    expect(negativePondCount.status).toBe(400);
    expect(negativePondCount.body.message).toBe('pondCount must be zero or greater');
  });

  it('DELETE /api/records/:id should delete record', async () => {
    mockDeleteEntry.mockResolvedValue(undefined);

    const response = await request(app)
      .delete('/api/records/rec-1')
      .set('Authorization', `Bearer ${farmerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Record deleted successfully');
  });

  it('GET /api/records/:id should return 404 when not found', async () => {
    mockGetEntryById.mockResolvedValue(null);

    const response = await request(app)
      .get('/api/records/rec-404')
      .set('Authorization', `Bearer ${farmerToken}`);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Record not found');
  });

  it('GET /api/records/:id should return record when found', async () => {
    mockGetEntryById.mockResolvedValue({ id: 'rec-1' });

    const response = await request(app)
      .get('/api/records/rec-1')
      .set('Authorization', `Bearer ${farmerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe('rec-1');
  });

  it('should pass unauthorized error to next when controller is called without user', async () => {
    const req = { user: undefined, query: {}, params: {}, body: {} } as any;
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() } as any;
    const next = jest.fn();

    await RecordController.getRecords(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401, message: 'Unauthorized' }));
  });

  it('should pass missing id error to next for getRecordById and deleteRecord', async () => {
    const req = { user: { id: 'farmer-1', role: 'FARMER' }, params: {} } as any;
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() } as any;
    const next = jest.fn();

    await RecordController.getRecordById(req, res, next);
    await RecordController.deleteRecord(req, res, next);

    expect(next).toHaveBeenNthCalledWith(1, expect.objectContaining({ status: 400, message: 'Record ID is required' }));
    expect(next).toHaveBeenNthCalledWith(2, expect.objectContaining({ status: 400, message: 'Record ID is required' }));
  });
});
