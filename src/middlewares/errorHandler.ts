import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

type AppError = Error & { status?: number; details?: unknown };

const errorHandler = (err: AppError, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status ?? 500;

  logger.error('Unhandled application error', {
    status,
    message: err.message,
    stack: err.stack,
    details: err.details,
  });

  res.status(status).json({
    message: err.message || 'Internal server error',
    ...(err.details ? { details: err.details } : {}),
  });
};

export { errorHandler };
