import { NextFunction, Request, Response } from 'express';
import { DukeFarmJwtPayload, verifyJwt } from '../utils/jwt';

export type AuthenticatedUser = {
  id: string;
  provider: 'LOCAL' | 'LINE';
  displayName?: string | undefined;
  pictureUrl?: string | undefined;
  role?: string | undefined;
};

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or invalid authorization header' });
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = verifyJwt<DukeFarmJwtPayload>(token);
    req.user = {
      id: payload.sub,
      provider: payload.provider,
      displayName: payload.displayName,
      pictureUrl: payload.pictureUrl,
      role: payload.role,
    };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

export { authMiddleware };
