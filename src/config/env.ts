import dotenv from 'dotenv';

dotenv.config();

type NodeEnv = 'development' | 'test' | 'production';

type EnvShape = {
  nodeEnv: NodeEnv;
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  lineChannelId: string;
  lineChannelSecret: string;
  lineRedirectUri: string;
  frontendCallbackUrl: string;
  googleMapsApiKey: string;
};

const requiredVars: Array<keyof Omit<EnvShape, 'nodeEnv' | 'port'>> = [
  'databaseUrl',
  'jwtSecret',
  'lineChannelId',
  'lineChannelSecret',
  'lineRedirectUri',
  'frontendCallbackUrl',
  'googleMapsApiKey',
];

const normalizePort = (value: string | undefined, fallback = 4000): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const buildEnv = (): EnvShape => {
  const env: EnvShape = {
    nodeEnv: (process.env.NODE_ENV as NodeEnv) ?? 'development',
    port: normalizePort(process.env.PORT, 4000),
    databaseUrl: process.env.DATABASE_URL ?? '',
    jwtSecret: process.env.JWT_SECRET ?? '',
    lineChannelId: process.env.LINE_CHANNEL_ID ?? '',
    lineChannelSecret: process.env.LINE_CHANNEL_SECRET ?? '',
    lineRedirectUri: process.env.LINE_REDIRECT_URI ?? '',
    frontendCallbackUrl: process.env.FRONTEND_CALLBACK_URL ?? '',
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? '',
  };

  requiredVars.forEach((key) => {
    if (!env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  });

  return env;
};

export const env = buildEnv();
