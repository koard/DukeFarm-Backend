import { NextFunction, Response } from 'express';
import { AuthenticatedRequest, AuthenticatedUser } from '../middlewares/auth.middleware';
import { FarmsService } from '../services/farms.service';
import { FARM_TYPE_VALUES, FarmTypeValue } from '../types/farm';
import { parseOptionalNumber } from '../utils/number';
import { createHttpError } from '../utils/httpError';

const ensureAuthenticated = (req: AuthenticatedRequest): AuthenticatedUser => {
  if (!req.user) {
    throw createHttpError(401, 'Unauthorized');
  }
  return req.user;
};

const parseFarmType = (value: unknown): FarmTypeValue | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const candidate = value.toUpperCase();
  return (FARM_TYPE_VALUES as readonly string[]).includes(candidate)
    ? (candidate as FarmTypeValue)
    : null;
};

const list = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = ensureAuthenticated(req);
    const role: string = user.role ?? 'FARMER';
    const farms = await FarmsService.listFarms({ userId: user.id, role });
    res.json({ data: farms });
  } catch (error) {
    next(error);
  }
};

const create = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = ensureAuthenticated(req);
    const { name, farmType, address, province } = req.body;

    if (!name || !farmType) {
  throw createHttpError(400, 'name and farmType are required');
    }

    const parsedFarmType = parseFarmType(farmType);
    if (!parsedFarmType) {
  throw createHttpError(400, `farmType must be one of: ${FARM_TYPE_VALUES.join(', ')}`);
    }

    const latitude = parseOptionalNumber(req.body.latitude, 'latitude');
    const longitude = parseOptionalNumber(req.body.longitude, 'longitude');
    const areaM2 = parseOptionalNumber(req.body.areaM2, 'areaM2');

    const farm = await FarmsService.createFarm(user.id, {
      name,
      farmType: parsedFarmType,
      address: address ?? null,
      province: province ?? null,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      areaM2: areaM2 ?? null,
    });

    res.status(201).json({ data: farm });
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

    const role: string = user.role ?? 'FARMER';
    const farm = await FarmsService.getFarmById(id, user.id, role);
    if (!farm) {
      throw createHttpError(404, 'Farm not found');
    }

    res.json({ data: farm });
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

    const payload: {
      name?: string;
      farmType?: FarmTypeValue;
      address?: string | null;
      province?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      areaM2?: number | null;
    } = {};
    const updatableFields = ['name', 'farmType', 'address', 'province'] as const;

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        const value = req.body[field];
        if (field === 'farmType') {
          const parsedFarmType = parseFarmType(value);
          if (!parsedFarmType) {
            throw createHttpError(400, `farmType must be one of: ${FARM_TYPE_VALUES.join(', ')}`);
          }
          payload.farmType = parsedFarmType;
        } else {
          payload[field] = value ?? null;
        }
      }
    });

    const numericFields: Array<{ key: 'latitude' | 'longitude' | 'areaM2'; label: string }> = [
      { key: 'latitude', label: 'latitude' },
      { key: 'longitude', label: 'longitude' },
      { key: 'areaM2', label: 'areaM2' },
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

    const role: string = user.role ?? 'FARMER';
    const updated = await FarmsService.updateFarm(id, user.id, role, payload);
    if (!updated) {
      throw createHttpError(404, 'Farm not found');
    }

    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
};

export const FarmsController = {
  list,
  create,
  getById,
  update,
};
