import { NextFunction, Response } from 'express';
import { FarmType, PondType } from '@prisma/client';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { createHttpError } from '../utils/httpError';
import { FarmDataEntryService } from '../services/farm-data-entry.service';

const parseFarmType = (raw: string | undefined): FarmType => {
  if (!raw) {
    throw createHttpError(400, 'farmType is required');
  }

  const upper = raw.toUpperCase();
  const values = Object.values(FarmType);
  if (!values.includes(upper as FarmType)) {
    throw createHttpError(400, `Unsupported farmType: ${raw}`);
  }

  return upper as FarmType;
};

const parsePondType = (raw: unknown): PondType | null => {
  if (typeof raw !== 'string' || raw.length === 0) {
    return null;
  }

  const upper = raw.toUpperCase();
  const values = Object.values(PondType);
  if (!values.includes(upper as PondType)) {
    throw createHttpError(400, `Unsupported pondType: ${raw}`);
  }

  return upper as PondType;
};

const parseRecordDate = (raw: unknown): Date => {
  if (typeof raw !== 'string' || raw.length === 0) {
    throw createHttpError(400, 'recordedAt is required');
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw createHttpError(400, 'recordedAt is invalid');
  }

  return date;
};

const parsePositiveNumber = (raw: unknown, field: string): number | null => {
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }

  const value = typeof raw === 'number' ? raw : Number(raw);
  if (Number.isNaN(value)) {
    throw createHttpError(400, `${field} must be a number`);
  }

  if (value < 0) {
    throw createHttpError(400, `${field} must be zero or greater`);
  }

  return value;
};

const getFormState = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      throw createHttpError(401, 'Unauthorized');
    }

    const farmTypeParam = typeof req.query.farmType === 'string' ? req.query.farmType : undefined;
    const farmType = parseFarmType(farmTypeParam);

    const formState = await FarmDataEntryService.getFormState(user.id, farmType);
    res.json({ data: formState });
  } catch (error) {
    next(error);
  }
};

const getRecords = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      throw createHttpError(401, 'Unauthorized');
    }

    const pondId = typeof req.query.pondId === 'string' ? req.query.pondId : undefined;
    const farmTypeParam = typeof req.query.farmType === 'string' ? req.query.farmType : undefined;
    let farmType: FarmType | undefined;
    if (farmTypeParam) {
      try {
        farmType = parseFarmType(farmTypeParam);
      } catch (e) {
        // ignore or throw? Better to ignore invalid farmType filter for listing? 
        // Or strict? strict is better.
        throw createHttpError(400, `Invalid farmType: ${farmTypeParam}`);
      }
    }

    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));

    const result = await FarmDataEntryService.getUserEntries(user.id, pondId, farmType, page, limit);
    res.json({ data: result.data, pagination: result.pagination });
  } catch (error) {
    next(error);
  }
};

const createRecord = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      throw createHttpError(401, 'Unauthorized');
    }

    if (user.role !== 'FARMER') {
      throw createHttpError(403, 'Only farmer accounts can submit farm records');
    }

    const farmType = parseFarmType(req.body?.farmType);
    const recordedAt = parseRecordDate(req.body?.recordedAt);

    const fishAgeLabelRaw = typeof req.body?.fishAgeLabel === 'string' ? req.body.fishAgeLabel.trim() : '';
    if (!fishAgeLabelRaw) {
      throw createHttpError(400, 'fishAgeLabel is required');
    }

    const pondType = parsePondType(req.body?.pondType);
    const pondCount = parsePositiveNumber(req.body?.pondCount, 'pondCount');

    const foodAmountKg = parsePositiveNumber(req.body?.foodAmountKg, 'foodAmountKg');
    const notes = typeof req.body?.notes === 'string' ? req.body.notes : undefined;

    const weatherPayload = req.body?.weather
      ? {
        temperatureC: req.body.weather.temperatureC !== undefined ? Number(req.body.weather.temperatureC) : null,
        rainMm: req.body.weather.rainMm !== undefined ? Number(req.body.weather.rainMm) : null,
        humidityPct: req.body.weather.humidityPct !== undefined ? Number(req.body.weather.humidityPct) : null,
      }
      : null;

    if (weatherPayload) {
      ['temperatureC', 'rainMm', 'humidityPct'].forEach((key) => {
        const typedKey = key as keyof typeof weatherPayload;
        const rawValue = weatherPayload[typedKey];
        if (rawValue !== null && Number.isNaN(rawValue)) {
          throw createHttpError(400, `weather.${typedKey} must be a number`);
        }
      });
    }

    const pondId = typeof req.body?.pondId === 'string' ? req.body.pondId : undefined;
    const fishReleased = parsePositiveNumber(req.body?.fishReleased, 'fishReleased');
    const fishRemaining = parsePositiveNumber(req.body?.fishRemaining, 'fishRemaining');
    const averageFishWeightGr = parsePositiveNumber(req.body?.averageFishWeightGr, 'averageFishWeightGr');
    const feedFormulaName = typeof req.body?.feedFormulaName === 'string' ? req.body.feedFormulaName : undefined;
    const supplementName = typeof req.body?.supplementName === 'string' ? req.body.supplementName : undefined;
    const medicineName = typeof req.body?.medicineName === 'string' ? req.body.medicineName : undefined;
    const foodCostBaht = parsePositiveNumber(req.body?.foodCostBaht, 'foodCostBaht');
    const medicineCostBaht = parsePositiveNumber(req.body?.medicineCostBaht, 'medicineCostBaht');
    const cycleStartDate = req.body?.cycleStartDate ? new Date(req.body.cycleStartDate) : null;

    const entry = await FarmDataEntryService.createEntry(user.id, {
      farmType,
      recordedAt,
      cycleStartDate,
      fishAgeLabel: fishAgeLabelRaw,
      pondId,
      pondType,
      pondCount,
      fishReleased: fishReleased ?? null,
      fishRemaining: fishRemaining ?? null,
      averageFishWeightGr,
      foodAmountKg,
      feedFormulaName,
      supplementName,
      medicineName,
      foodCostBaht,
      medicineCostBaht,
      weather: weatherPayload,
      notes,
    });

    res.status(201).json({ data: entry });
  } catch (error) {
    next(error);
  }
};

const updateRecord = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      throw createHttpError(401, 'Unauthorized');
    }

    const { id } = req.params;
    if (!id) {
      throw createHttpError(400, 'Record ID is required');
    }

    const updateInput: any = {};
    if (req.body?.recordedAt) updateInput.recordedAt = parseRecordDate(req.body.recordedAt);
    if (typeof req.body?.fishAgeLabel === 'string') updateInput.fishAgeLabel = req.body.fishAgeLabel.trim();
    if (req.body?.pondType) updateInput.pondType = parsePondType(req.body.pondType);
    if (req.body?.pondCount) updateInput.pondCount = parsePositiveNumber(req.body.pondCount, 'pondCount');
    if (req.body?.fishReleased) updateInput.fishReleased = parsePositiveNumber(req.body.fishReleased, 'fishReleased');
    if (req.body?.fishRemaining) updateInput.fishRemaining = parsePositiveNumber(req.body.fishRemaining, 'fishRemaining');
    if (req.body?.foodAmountKg) updateInput.foodAmountKg = parsePositiveNumber(req.body.foodAmountKg, 'foodAmountKg');
    if (typeof req.body?.notes === 'string') updateInput.notes = req.body.notes;

    if (req.body?.weather) {
      updateInput.weather = {
        temperatureC: req.body.weather.temperatureC !== undefined ? Number(req.body.weather.temperatureC) : null,
        rainMm: req.body.weather.rainMm !== undefined ? Number(req.body.weather.rainMm) : null,
        humidityPct: req.body.weather.humidityPct !== undefined ? Number(req.body.weather.humidityPct) : null,
      };
    }

    const entry = await FarmDataEntryService.updateEntry(id, updateInput);

    res.json({ data: entry });

  } catch (error) {
    next(error);
  }
};

const deleteRecord = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      throw createHttpError(401, 'Unauthorized');
    }

    const { id } = req.params;
    if (!id) {
      throw createHttpError(400, 'Record ID is required');
    }

    await FarmDataEntryService.deleteEntry(id);
    res.json({ message: 'Record deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const RecordController = {
  getFormState,
  getRecords,
  createRecord,
  updateRecord,
  deleteRecord,
};
