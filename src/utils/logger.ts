type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const log = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
  const payload = {
    level,
    timestamp: new Date().toISOString(),
    message,
    ...(meta ?? {}),
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
