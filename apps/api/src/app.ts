import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import type { HealthDto } from '@helpdesk/shared';
import { webOrigins } from './config/env';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { originCheck } from './middleware/origin-check';
import { attachUser } from './middleware/auth';
import { authRouter } from './modules/auth/auth.router';
import { ticketsRouter, commentsRouter } from './modules/tickets/tickets.router';
import { slaRouter } from './modules/sla/sla.router';
import { categoriesRouter } from './modules/categories/categories.router';
import { usersRouter } from './modules/users/users.router';
import { notificationsRouter } from './modules/notifications/notifications.router';
import { auditRouter } from './modules/audit/audit.router';
import { analyticsRouter } from './modules/analytics/analytics.router';
import { attachmentsRouter, ticketAttachmentsRouter } from './modules/attachments/attachments.router';
import { openApiSpec } from './openapi/spec';
import swaggerUi from 'swagger-ui-express';
import path from 'node:path';
import { existsSync } from 'node:fs';

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
      serializers: {
        // Compact request logs — method/url/status/duration, no header dumps.
        req: (req) => ({ id: req.id, method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
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

  // /api/v1 — CSRF origin check + session resolution apply to all v1 routes.
  app.use('/api/v1', originCheck, attachUser);

  // OpenAPI docs — JSON spec + Swagger UI (not needed in prod but harmless)
  app.get('/api/docs.json', (_req, res) => res.json(openApiSpec));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec as never));

  // Feature routers:
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/tickets', ticketsRouter);
  app.use('/api/v1/categories', categoriesRouter);
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1/notifications', notificationsRouter);
  app.use('/api/v1/audit-logs', auditRouter);
  app.use('/api/v1/analytics', analyticsRouter);
  app.use('/api/v1/tickets/:id/attachments', ticketAttachmentsRouter);
  app.use('/api/v1/attachments', attachmentsRouter);
  app.use('/api/v1/comments', commentsRouter);
  app.use('/api/v1/sla-targets', slaRouter);

  // Single-service production mode: serve the built SPA when a dist folder
  // exists. Dev never hits this — Vite serves the frontend on :5173.
  const webDist = path.resolve(process.env.WEB_DIST ?? 'apps/web/dist');
  if (existsSync(path.join(webDist, 'index.html'))) {
    app.use(express.static(webDist));
    app.get('*', (req, res, next) =>
      req.path.startsWith('/api') || req.path.startsWith('/socket.io')
        ? next()
        : res.sendFile(path.join(webDist, 'index.html')),
    );
  }

  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}
