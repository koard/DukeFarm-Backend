import { FarmingGroup, UserRole } from '@prisma/client';
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

const parseFarmingGroup = (raw: unknown): FarmingGroup => {
  if (typeof raw !== 'string') {
    throw createHttpError(400, 'farmingGroup is required');
  }

  const normalized = raw.toUpperCase();
  if (!(Object.values(FarmingGroup) as string[]).includes(normalized)) {
    throw createHttpError(400, `farmingGroup must be one of: ${Object.values(FarmingGroup).join(', ')}`);
  }

  return normalized as FarmingGroup;
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

    const payload = {
      firstName: requireTrimmedString(req.body?.firstName, 'firstName'),
      lastName: requireTrimmedString(req.body?.lastName, 'lastName'),
      phone: requireTrimmedString(req.body?.phone, 'phone'),
      farmingGroup: parseFarmingGroup(req.body?.farmingGroup),
      declaredPondCount: parseDeclaredPondCount(req.body?.declaredPondCount),
      farmLatitude: parseLatitude(req.body?.farmLatitude),
      farmLongitude: parseLongitude(req.body?.farmLongitude),
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
