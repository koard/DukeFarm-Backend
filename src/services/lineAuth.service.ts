import crypto from 'crypto';
import { RegistrationStatus, UserRole } from '@prisma/client';
import { prisma } from '../clients/prisma';
import { env } from '../config/env';
import { signJwt } from '../utils/jwt';
import { exchangeCodeForTokens, fetchLineProfile } from '../utils/lineApi';

type LineLoginResult = {
  token: string;
  user: {
    id: string;
    displayName: string;
    pictureUrl?: string | null;
    role: UserRole;
    registrationStatus: RegistrationStatus;
  };
};

const LINE_AUTHORIZE_ENDPOINT = 'https://access.line.me/oauth2/v2.1/authorize';
const STATE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const pendingStates = new Map<string, { nonce: string; createdAt: number }>();

const purgeExpiredStates = () => {
  const expiry = Date.now() - STATE_TTL_MS;
  for (const [state, meta] of pendingStates.entries()) {
    if (meta.createdAt < expiry) {
      pendingStates.delete(state);
    }
  }
};

const createRandomHex = () => crypto.randomBytes(16).toString('hex');

const createLoginUrl = () => {
  purgeExpiredStates();
  const state = createRandomHex();
  const nonce = createRandomHex();

  pendingStates.set(state, { nonce, createdAt: Date.now() });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.lineChannelId,
    redirect_uri: env.lineRedirectUri,
    scope: 'openid profile',
    state,
    nonce,
  });

  return {
    url: `${LINE_AUTHORIZE_ENDPOINT}?${params.toString()}`,
    state,
  };
};

const validateState = (state?: string) => {
  if (!state) {
    throw new Error('Missing state');
  }

  purgeExpiredStates();
  const entry = pendingStates.get(state);
  if (!entry) {
    throw new Error('Invalid or expired state');
  }

  pendingStates.delete(state);
  return entry.nonce;
};

const ensureDisplayName = (displayName?: string | null) => displayName ?? 'LINE User';

const handleCallback = async (code: string, state?: string): Promise<LineLoginResult> => {
  validateState(state);

  const tokenResponse = await exchangeCodeForTokens(code);
  const profile = await fetchLineProfile(tokenResponse.access_token);

  const upsertedUser = await prisma.user.upsert({
    where: { lineUserId: profile.userId },
    update: {
      displayName: ensureDisplayName(profile.displayName),
      pictureUrl: profile.pictureUrl ?? null,
    },
    create: {
      passwordHash: crypto.randomBytes(32).toString('hex'),
      lineUserId: profile.userId,
      displayName: ensureDisplayName(profile.displayName),
      pictureUrl: profile.pictureUrl ?? null,
      loginProvider: 'LINE',
      role: UserRole.UNASSIGNED,
      registrationStatus: RegistrationStatus.PENDING,
    },
  });

  const displayName = ensureDisplayName(upsertedUser.displayName);

  const tokenPayload = {
    sub: upsertedUser.id,
    provider: 'LINE' as const,
    displayName,
    ...(upsertedUser.pictureUrl ? { pictureUrl: upsertedUser.pictureUrl } : {}),
    role: upsertedUser.role,
    registrationStatus: upsertedUser.registrationStatus,
  };

  const token = signJwt(tokenPayload);

  return {
    token,
    user: {
      id: upsertedUser.id,
      displayName,
      pictureUrl: upsertedUser.pictureUrl,
      role: upsertedUser.role,
      registrationStatus: upsertedUser.registrationStatus,
    },
  };
};

export const LineAuthService = {
  createLoginUrl,
  handleCallback,
};
