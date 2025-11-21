import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export type DukeFarmJwtPayload = {
  sub: string;
  provider: 'LOCAL' | 'LINE';
  displayName?: string;
  pictureUrl?: string;
  role?: string;
  registrationStatus?: string;
};

const defaultOptions: SignOptions = {
  expiresIn: '7d',
};

const signJwt = (payload: DukeFarmJwtPayload, options?: SignOptions) =>
  jwt.sign(payload, env.jwtSecret, { ...defaultOptions, ...options });

const verifyJwt = <T extends object = DukeFarmJwtPayload>(token: string): T =>
  jwt.verify(token, env.jwtSecret) as T;

export { signJwt, verifyJwt };
