import dotenv from 'dotenv';

dotenv.config();

type NodeEnv = 'development' | 'test' | 'production';

type EnvShape = {
  nodeEnv: NodeEnv;
  port: number;
  databaseUrl: string;
  googleWeatherApiKey: string;
  jwtSecret: string;
  lineChannelId: string;
  lineChannelSecret: string;
  lineRedirectUri: string;
  frontendCallbackUrl: string;
};

const requiredVars: Array<keyof Omit<EnvShape, 'nodeEnv' | 'port'>> = [
  'databaseUrl',
  'googleWeatherApiKey',
  'jwtSecret',
  'lineChannelId',
  'lineChannelSecret',
  'lineRedirectUri',
  'frontendCallbackUrl',
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
    googleWeatherApiKey: process.env.GOOGLE_WEATHER_API_KEY ?? '',
    jwtSecret: process.env.JWT_SECRET ?? '',
    lineChannelId: process.env.LINE_CHANNEL_ID ?? '',
    lineChannelSecret: process.env.LINE_CHANNEL_SECRET ?? '',
    lineRedirectUri: process.env.LINE_REDIRECT_URI ?? '',
    frontendCallbackUrl: process.env.FRONTEND_CALLBACK_URL ?? '',
  };

  requiredVars.forEach((key) => {
    if (!env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  });

  return env;
};

export const env = buildEnv();
