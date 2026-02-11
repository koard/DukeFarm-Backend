import { FarmType, PondType, UserRole } from '@prisma/client';
import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { createHttpError } from '../utils/httpError';
import { parseOptionalNumber } from '../utils/number';
import { OnboardingService } from '../services/onboarding.service';

const ensureAuthenticated = (req: AuthenticatedRequest) => {
  if (!req.user) {
    throw createHttpError(401, 'Unauthorized');
  }

  return req.user;
};

const requireTrimmedString = (value: unknown, field: string): string => {
  if (typeof value !== 'string') {
    throw createHttpError(400, `${field} is required`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw createHttpError(400, `${field} is required`);
  }

  return trimmed;
};

const optionalTrimmedString = (value: unknown, field: string): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw createHttpError(400, `${field} must be a string`);
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const parseRole = (raw: unknown): UserRole => {
  if (typeof raw !== 'string') {
    throw createHttpError(400, 'role is required');
  }

  const normalized = raw.toUpperCase();
  if (normalized !== UserRole.FARMER && normalized !== UserRole.RESEARCHER) {
    throw createHttpError(400, 'role must be either FARMER or RESEARCHER');
  }

  return normalized as UserRole;
};

const parseFarmTypes = (raw: unknown): FarmType[] => {
  const validValues = Object.values(FarmType);

  const normalize = (value: string): FarmType => {
    const upper = value.toUpperCase();
    if (!validValues.includes(upper as FarmType)) {
      throw createHttpError(400, `Unsupported farm type: ${value}`);
    }
    return upper as FarmType;
  };

  if (Array.isArray(raw)) {
    const parsed = raw.map((value) => {
      if (typeof value !== 'string') {
        throw createHttpError(400, 'farmTypes must be strings');
      }
      return normalize(value);
    });
    if (!parsed.length) {
      throw createHttpError(400, 'At least one farm type is required');
    }
    return Array.from(new Set(parsed));
  }

  if (typeof raw === 'string' && raw.trim().length > 0) {
    const values = raw.split(',').map((item) => normalize(item.trim()));
    return Array.from(new Set(values));
  }

  throw createHttpError(400, 'farmTypes is required and must contain at least one value');
};

type PondInput = {
  pondType: PondType;
  farmType: FarmType;
  widthM: number;
  lengthM: number;
  depthM: number;
  volumeM3: number;
};

const parsePositiveNumber = (value: unknown, field: string): number => {
  if (value === undefined || value === null) {
    throw createHttpError(400, `${field} is required`);
  }
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  if (isNaN(num) || num <= 0) {
    throw createHttpError(400, `${field} must be a positive number`);
  }
  return num;
};

const parsePondType = (raw: unknown): PondType => {
  if (typeof raw !== 'string') {
    throw createHttpError(400, 'pondType is required');
  }
  const upper = raw.toUpperCase();
  if (upper !== PondType.EARTHEN && upper !== PondType.CONCRETE) {
    throw createHttpError(400, 'pondType must be EARTHEN or CONCRETE');
  }
  return upper as PondType;
};

const parseFarmType = (raw: unknown, field: string): FarmType => {
  if (typeof raw !== 'string') {
    throw createHttpError(400, `${field} is required`);
  }
  const upper = raw.toUpperCase();
  const validValues = Object.values(FarmType);
  if (!validValues.includes(upper as FarmType)) {
    throw createHttpError(400, `${field} must be one of: ${validValues.join(', ')}`);
  }
  return upper as FarmType;
};

const parsePonds = (raw: unknown): PondInput[] => {
  if (!Array.isArray(raw)) {
    throw createHttpError(400, 'ponds is required and must be an array');
  }

  if (raw.length === 0) {
    throw createHttpError(400, 'At least one pond is required');
  }

  return raw.map((pond, index) => {
    if (typeof pond !== 'object' || pond === null) {
      throw createHttpError(400, `ponds[${index}] must be an object`);
    }

    const p = pond as Record<string, unknown>;
    const pondType = parsePondType(p.pondType);
    const farmType = parseFarmType(p.farmType, `ponds[${index}].farmType`);
    const widthM = parsePositiveNumber(p.widthM, `ponds[${index}].widthM`);
    const lengthM = parsePositiveNumber(p.lengthM, `ponds[${index}].lengthM`);
    const depthM = parsePositiveNumber(p.depthM, `ponds[${index}].depthM`);
    const volumeM3 = Math.round(widthM * lengthM * depthM * 100) / 100;

    return { pondType, farmType, widthM, lengthM, depthM, volumeM3 };
  });
};

const parseDeclaredPondCount = (value: unknown): number | null => {
  const parsed = parseOptionalNumber(value, 'declaredPondCount');
  if (parsed === undefined || parsed === null) {
    return null;
  }

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw createHttpError(400, 'declaredPondCount must be a non-negative integer');
  }

  return parsed;
};

const parseLatitude = (value: unknown): number => {
  const parsed = parseOptionalNumber(value, 'farmLatitude');
  if (parsed === undefined || parsed === null) {
    throw createHttpError(400, 'farmLatitude is required');
  }

  if (parsed < -90 || parsed > 90) {
    throw createHttpError(400, 'farmLatitude must be between -90 and 90');
  }

  return parsed;
};

const parseLongitude = (value: unknown): number => {
  const parsed = parseOptionalNumber(value, 'farmLongitude');
  if (parsed === undefined || parsed === null) {
    throw createHttpError(400, 'farmLongitude is required');
  }

  if (parsed < -180 || parsed > 180) {
    throw createHttpError(400, 'farmLongitude must be between -180 and 180');
  }

  return parsed;
};

const parseNonNegativeDecimal = (value: unknown, field: string): number | null => {
  const parsed = parseOptionalNumber(value, field);
  if (parsed === undefined) {
    return null;
  }

  if (parsed < 0) {
    throw createHttpError(400, `${field} must be zero or greater`);
  }

  return parsed;
};

const selectRole = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = ensureAuthenticated(req);
    const role = parseRole(req.body?.role);
    const result = await OnboardingService.selectRole(user.id, role);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

const submitFarmerProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = ensureAuthenticated(req);
    const ponds = parsePonds(req.body?.ponds);

    const payload = {
      firstName: requireTrimmedString(req.body?.firstName, 'firstName'),
      lastName: requireTrimmedString(req.body?.lastName, 'lastName'),
      phone: requireTrimmedString(req.body?.phone, 'phone'),
      farmTypes: parseFarmTypes(
        req.body?.farmTypes ?? req.body?.selectedFarmTypes ?? req.body?.primaryFarmType,
      ),
      declaredPondCount: ponds.length,
      farmLatitude: parseLatitude(req.body?.farmLatitude),
      farmLongitude: parseLongitude(req.body?.farmLongitude),
      farmAreaRai: parseNonNegativeDecimal(req.body?.farmAreaRai, 'farmAreaRai'),
      pondsPerRai: parseNonNegativeDecimal(req.body?.pondsPerRai, 'pondsPerRai'),
      ponds,
    };

    const result = await OnboardingService.completeFarmerProfile(user.id, payload);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

const submitResearcherProfile = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = ensureAuthenticated(req);

    const payload = {
      firstName: requireTrimmedString(req.body?.firstName, 'firstName'),
      lastName: requireTrimmedString(req.body?.lastName, 'lastName'),
      email: requireTrimmedString(req.body?.email, 'email'),
      phone: requireTrimmedString(req.body?.phone, 'phone'),
      organization: requireTrimmedString(req.body?.organization, 'organization'),
      department: optionalTrimmedString(req.body?.department, 'department'),
      jobTitle: optionalTrimmedString(req.body?.jobTitle, 'jobTitle'),
    };

    const result = await OnboardingService.completeResearcherProfile(user.id, payload);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const OnboardingController = {
  selectRole,
  submitFarmerProfile,
  submitResearcherProfile,
};
