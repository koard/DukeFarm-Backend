describe('config/env', () => {
  const ORIGINAL_ENV = process.env;

  const baseEnv = {
    DATABASE_URL: 'postgres://test',
    JWT_SECRET: 'secret',
    LINE_CHANNEL_ID: 'line-id',
    LINE_CHANNEL_SECRET: 'line-secret',
    LINE_REDIRECT_URI: 'https://example.com/line/callback',
    FRONTEND_CALLBACK_URL: 'https://example.com/frontend/callback',
    GOOGLE_MAPS_API_KEY: 'google-key',
  } as const;

  const loadEnvModule = () => {
    let loaded: any;
    jest.isolateModules(() => {
      jest.doMock('dotenv', () => ({
        __esModule: true,
        default: { config: jest.fn() },
      }));
      loaded = require('../../config/env');
    });
    return loaded as { env: any };
  };

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...ORIGINAL_ENV,
      ...baseEnv,
      NODE_ENV: 'test',
      PORT: '5555',
    };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('builds env with explicit numeric port', () => {
    const { env } = loadEnvModule();

    expect(env.nodeEnv).toBe('test');
    expect(env.port).toBe(5555);
    expect(env.databaseUrl).toBe(baseEnv.DATABASE_URL);
    expect(env.googleMapsApiKey).toBe(baseEnv.GOOGLE_MAPS_API_KEY);
  });

  it('falls back to default port when PORT is missing', () => {
    delete process.env.PORT;

    const { env } = loadEnvModule();

    expect(env.port).toBe(4000);
  });

  it('falls back to default port when PORT is invalid', () => {
    process.env.PORT = 'not-a-number';

    const { env } = loadEnvModule();

    expect(env.port).toBe(4000);
  });

  it('uses default nodeEnv when NODE_ENV is missing', () => {
    delete process.env.NODE_ENV;

    const { env } = loadEnvModule();

    expect(env.nodeEnv).toBe('development');
  });

  it('throws when a required variable is missing', () => {
    delete process.env.GOOGLE_MAPS_API_KEY;

    expect(() => loadEnvModule()).toThrow('Missing required environment variable: googleMapsApiKey');
  });

  it.each([
    ['DATABASE_URL', 'databaseUrl'],
    ['JWT_SECRET', 'jwtSecret'],
    ['LINE_CHANNEL_ID', 'lineChannelId'],
    ['LINE_CHANNEL_SECRET', 'lineChannelSecret'],
    ['LINE_REDIRECT_URI', 'lineRedirectUri'],
    ['FRONTEND_CALLBACK_URL', 'frontendCallbackUrl'],
    ['GOOGLE_MAPS_API_KEY', 'googleMapsApiKey'],
  ])('throws when %s is missing', (envVar, expectedKey) => {
    delete process.env[envVar as keyof NodeJS.ProcessEnv];

    expect(() => loadEnvModule()).toThrow(`Missing required environment variable: ${expectedKey}`);
  });
});
