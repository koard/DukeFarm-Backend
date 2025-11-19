import { NextFunction, Response } from 'express';
import { prisma } from '../clients/prisma';
import { AuthenticatedRequest } from './auth.middleware';

const roleMiddleware = (allowedRoles: string[]) => async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    req.user.role = user.role;

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    next();
  } catch (error) {
    next(error);
  }
};

export { roleMiddleware };
