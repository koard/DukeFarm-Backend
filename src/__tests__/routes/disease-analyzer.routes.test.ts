import express from 'express';
import request from 'supertest';

describe('disease-analyzer.routes', () => {
  const loadRouteModule = (existsSyncValue: boolean) => {
    jest.resetModules();

    const fsMock = {
      existsSync: jest.fn().mockReturnValue(existsSyncValue),
      mkdirSync: jest.fn(),
    };

    const captured: { fileFilter?: any; storageConfig?: any } = {};

    jest.doMock('fs', () => ({
      __esModule: true,
      default: fsMock,
      ...fsMock,
    }));

    jest.doMock('multer', () => {
      const multerMock: any = jest.fn((options: any) => {
        captured.fileFilter = options.fileFilter;
        return {
          single: () => (_req: any, _res: any, next: any) => next(),
        };
      });

      multerMock.diskStorage = jest.fn((config: any) => {
        captured.storageConfig = config;
        return {};
      });

      return {
        __esModule: true,
        default: multerMock,
      };
    });

    const handlers = {
      searchDiseases: jest.fn((_req, res) => res.status(200).json({ ok: true })),
      getDisease: jest.fn((_req, res) => res.status(200).json({ ok: true })),
      createDisease: jest.fn((_req, res) => res.status(200).json({ ok: true })),
      updateDisease: jest.fn((_req, res) => res.status(200).json({ ok: true })),
      deleteDisease: jest.fn((_req, res) => res.status(200).json({ ok: true })),
      getSymptomChips: jest.fn((_req, res) => res.status(200).json({ chips: [] })),
      analyze: jest.fn((_req, res) => res.status(200).json({ analyzed: true })),
      listAnalysisRequests: jest.fn((_req, res) => res.status(200).json({ data: [] })),
      getResult: jest.fn((_req, res) => res.status(200).json({ data: null })),
    };

    jest.doMock('../../controllers/disease-analyzer.controller', () => ({
      DiseaseAnalyzerController: handlers,
    }));

    const { diseaseAnalyzerRouter } = require('../../routes/disease-analyzer.routes');

    return { diseaseAnalyzerRouter, fsMock, captured, handlers };
  };

  it('creates upload directory when it does not exist', () => {
    const { fsMock } = loadRouteModule(false);

    expect(fsMock.existsSync).toHaveBeenCalled();
    expect(fsMock.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('uploads'), { recursive: true });
  });

  it('does not create upload directory when it already exists', () => {
    const { fsMock } = loadRouteModule(true);

    expect(fsMock.existsSync).toHaveBeenCalled();
    expect(fsMock.mkdirSync).not.toHaveBeenCalled();
  });

  it('fileFilter rejects invalid mimetype and accepts allowed mimetype', () => {
    const { captured } = loadRouteModule(true);

    const cbInvalid = jest.fn();
    captured.fileFilter({}, { mimetype: 'text/plain' }, cbInvalid);
    expect(cbInvalid).toHaveBeenCalledWith(expect.any(Error));

    const cbValid = jest.fn();
    captured.fileFilter({}, { mimetype: 'image/png' }, cbValid);
    expect(cbValid).toHaveBeenCalledWith(null, true);
  });

  it('builds upload filename with original extension', () => {
    const { captured } = loadRouteModule(true);
    const cb = jest.fn();

    captured.storageConfig.filename({}, { originalname: 'photo.jpeg' }, cb);

    expect(cb).toHaveBeenCalledWith(
      null,
      expect.stringMatching(/^\d+-[a-z0-9]+\.jpeg$/),
    );
  });

  it('wires router endpoints to controller handlers', async () => {
    const { diseaseAnalyzerRouter, handlers } = loadRouteModule(true);
    const app = express();
    app.use(express.json());
    app.use('/', diseaseAnalyzerRouter);

    const symptomsRes = await request(app).get('/symptoms');
    const requestsRes = await request(app).get('/disease-analyzer/requests');
    const resultRes = await request(app).get('/disease-analyzer/req-1');

    expect(symptomsRes.status).toBe(200);
    expect(requestsRes.status).toBe(200);
    expect(resultRes.status).toBe(200);
    expect(handlers.getSymptomChips).toHaveBeenCalled();
    expect(handlers.listAnalysisRequests).toHaveBeenCalled();
    expect(handlers.getResult).toHaveBeenCalled();
  });
});
