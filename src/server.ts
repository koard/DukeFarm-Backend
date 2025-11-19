import http from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';

const app = createApp();
const server = http.createServer(app);

const startServer = () => {
  server.listen(env.port, () => {
    logger.info('DukeFarm backend listening', { port: env.port, env: env.nodeEnv });
  });
};

const gracefulShutdown = (signal: NodeJS.Signals) => {
  logger.warn('Received shutdown signal', { signal });
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Force exiting after shutdown timeout');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

startServer();
