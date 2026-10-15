import { pino } from 'pino';
import { isProd, isTest } from '../config/env';

/**
 * Structured JSON logging. Redaction paths ensure secrets never reach logs,
 * even if a caller accidentally logs a request object.
 */
export const logger = pino({
  level: isTest ? 'silent' : isProd ? 'info' : 'debug',
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.sessionToken',
    ],
    censor: '[REDACTED]',
  },
  ...(isProd || isTest
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        },
      }),
});
