import { NextFunction, Response } from 'express';
import { AuthenticatedRequest, AuthenticatedUser } from '../middlewares/auth.middleware';
import { PondsService, UpdatePondInput } from '../services/ponds.service';
import { WeatherService } from '../services/weather.service';
import { POND_TYPE_VALUES, PondTypeValue } from '../types/pond';
import { parseOptionalNumber } from '../utils/number';
import { createHttpError } from '../utils/httpError';
import { AccessService } from '../services/access.service';

const ensureAuthenticated = (req: AuthenticatedRequest): AuthenticatedUser => {
  if (!req.user) {
    throw createHttpError(401, 'Unauthorized');
  }

  return req.user;
};

const parsePondType = (value: unknown): PondTypeValue | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const candidate = value.toUpperCase();
  return (POND_TYPE_VALUES as readonly string[]).includes(candidate)
    ? (candidate as PondTypeValue)
    : null;
};

const listByFarm = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = ensureAuthenticated(req);
    const { farmId } = req.params;

    if (!farmId) {
      throw createHttpError(400, 'farmId is required');
    }

    await AccessService.ensureFarmAccess(farmId, user);

    const ponds = await PondsService.listByFarmId(farmId);
    res.json({ data: ponds });
  } catch (error) {
    next(error);
  }
};

const create = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = ensureAuthenticated(req);
    const { farmId } = req.params;

    if (!farmId) {
      throw createHttpError(400, 'farmId is required');
    }

    await AccessService.ensureFarmAccess(farmId, user);

    const { name, pondType, notes } = req.body;
    if (!name || !pondType) {
      throw createHttpError(400, 'name and pondType are required');
    }

    const parsedPondType = parsePondType(pondType);
    if (!parsedPondType) {
      throw createHttpError(400, `pondType must be one of: ${POND_TYPE_VALUES.join(', ')}`);
    }

    const areaM2 = parseOptionalNumber(req.body.areaM2, 'areaM2');
    const maxDepthM = parseOptionalNumber(req.body.maxDepthM, 'maxDepthM');

    const pond = await PondsService.createPond(farmId, {
      name,
      pondType: parsedPondType,
      notes: notes ?? null,
      areaM2: areaM2 ?? null,
      maxDepthM: maxDepthM ?? null,
    });

    res.status(201).json({ data: pond });
  } catch (error) {
    next(error);
  }
};

const getById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = ensureAuthenticated(req);
    const { id } = req.params;

    if (!id) {
      throw createHttpError(400, 'id is required');
    }

    const pond = await AccessService.ensurePondAccess(id, user);

    res.json({ data: pond });
  } catch (error) {
    next(error);
  }
};

const update = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = ensureAuthenticated(req);
    const { id } = req.params;

    if (!id) {
      throw createHttpError(400, 'id is required');
    }

    await AccessService.ensurePondAccess(id, user);

    const payload: UpdatePondInput = {};

    if (req.body.name !== undefined) {
      payload.name = req.body.name;
    }

    if (req.body.pondType !== undefined) {
      const parsed = parsePondType(req.body.pondType);
      if (!parsed) {
        throw createHttpError(400, `pondType must be one of: ${POND_TYPE_VALUES.join(', ')}`);
      }
      payload.pondType = parsed;
    }

    if (req.body.notes !== undefined) {
      payload.notes = req.body.notes ?? null;
    }

    const numericFields: Array<{ key: keyof Pick<UpdatePondInput, 'areaM2' | 'maxDepthM'>; label: string }> = [
      { key: 'areaM2', label: 'areaM2' },
      { key: 'maxDepthM', label: 'maxDepthM' },
    ];

    numericFields.forEach(({ key, label }) => {
      if (req.body[key] !== undefined) {
        const value = parseOptionalNumber(req.body[key], label);
        payload[key] = value ?? null;
      }
    });

    if (Object.keys(payload).length === 0) {
      throw createHttpError(400, 'No valid fields provided for update');
    }

    const updated = await PondsService.updatePond(id, payload);
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
};

const getWeather = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = ensureAuthenticated(req);
    const { id } = req.params;

    if (!id) {
      throw createHttpError(400, 'id is required');
    }

    const pond = await AccessService.ensurePondAccess(id, user);

    const latitude = pond.farm?.latitude;
    const longitude = pond.farm?.longitude;
    if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
      throw createHttpError(400, 'Farm is missing latitude/longitude coordinates');
    }

    const weather = await WeatherService.getCurrentWeather(latitude, longitude);

    res.json({
      pondId: pond.id,
      location: {
        latitude,
        longitude,
      },
      weather,
    });
  } catch (error) {
    next(error);
  }
};

export const PondsController = {
  listByFarm,
  create,
  getById,
  update,
  getWeather,
};
