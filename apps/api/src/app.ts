import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import type { HealthDto } from '@helpdesk/shared';
import { webOrigins } from './config/env';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/error-handler';

/**
 * Express app assembly — kept separate from server.ts so Supertest can
 * import the app without binding a port.
 */
export function createApp() {
  const app = express();

  // Behind Render/Vercel proxies — needed for Secure cookies + client IPs.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cors({ origin: webOrigins, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/api/health' },
    }),
  );

  // Liveness/readiness — used by uptime checks and the client status card.
  app.get('/api/health', (_req, res) => {
    const body: HealthDto = {
      status: 'ok',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
    res.json(body);
  });

  // API index — quick sanity check that the router is mounted.
  app.get('/api/v1', (_req, res) => {
    res.json({
      name: 'HelpDesk Pro API',
      version: 1,
      docs: '/api-docs',
    });
  });

  // Feature routers mount here in Phases 4-7:
  //   app.use('/api/v1/auth', authRouter);
  //   app.use('/api/v1/tickets', ticketsRouter);
  //   ...

  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}
