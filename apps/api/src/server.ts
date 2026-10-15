import http from 'node:http';
import { env } from './config/env';
import { logger } from './utils/logger';
import { createApp } from './app';
import { initSockets } from './sockets/io';
import { startSlaSweeper } from './jobs/sla-sweep';

/**
 * Entry point. One http.Server hosts both Express (REST) and Socket.IO.
 */
const app = createApp();
const server = http.createServer(app);
initSockets(server);
startSlaSweeper();

server.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, `API listening on http://localhost:${env.PORT}`);
});

/* Graceful shutdown — drain connections, exit cleanly for orchestrators. */
function shutdown(signal: string) {
  logger.info({ signal }, 'Shutdown requested');
  server.close((err) => {
    if (err) {
      logger.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
    logger.info('HTTP server closed');
    process.exit(0);
  });
  // Force-exit if connections linger beyond 10s
  setTimeout(() => {
    logger.warn('Forcing shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
