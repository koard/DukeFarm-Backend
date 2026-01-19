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
    const fishCountText = typeof req.body?.fishCountText === 'string' ? req.body.fishCountText : undefined;
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

    const entry = await FarmDataEntryService.createEntry(user.id, {
      farmType,
      recordedAt,
      fishAgeLabel: fishAgeLabelRaw,
      pondType,
      pondCount,
      fishCountText,
      foodAmountKg,
      weather: weatherPayload,
      notes,
    });

    res.status(201).json({ data: entry });
  } catch (error) {
    next(error);
  }
};

export const RecordController = {
  getFormState,
  createRecord,
};
