import { HttpError } from './httpError';

export const parseOptionalNumber = (value: unknown, field: string): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new HttpError(400, `${field} must be a number`);
  }

  return parsed;
};

export const decimalToNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
};
