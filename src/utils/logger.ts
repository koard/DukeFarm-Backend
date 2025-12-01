type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const serializeMetaValue = (value: unknown): unknown => {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (Array.isArray(value)) {
    return value.map(serializeMetaValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
        key,
        serializeMetaValue(nestedValue),
      ]),
    );
  }

  return value;
};

const serializeMeta = (meta?: Record<string, unknown>) => {
  if (!meta) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(meta).map(([key, value]) => [key, serializeMetaValue(value)]),
  );
};

const log = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
  const payload = {
    level,
    timestamp: new Date().toISOString(),
    message,
    ...(serializeMeta(meta) ?? {}),
  };

  const serialized = JSON.stringify(payload);

  switch (level) {
    case 'info':
    case 'debug':
      console.log(serialized);
      break;
    case 'warn':
      console.warn(serialized);
      break;
    case 'error':
      console.error(serialized);
      break;
    default:
      console.log(serialized);
  }
};

const logger = {
  info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),
  debug: (message: string, meta?: Record<string, unknown>) => log('debug', message, meta),
};

export { logger };
