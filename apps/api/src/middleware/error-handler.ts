import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ERROR_CODES, type ApiErrorBody } from '@helpdesk/shared';
import { isProd } from '../config/env';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

/** 404 for unmatched /api routes — JSON, not Express's HTML default. */
export function notFoundHandler(_req: Request, res: Response) {
  const body: ApiErrorBody = {
    error: { code: ERROR_CODES.NOT_FOUND, message: 'Route not found' },
  };
  res.status(404).json(body);
}

/**
 * Central error handler. Registered last; catches thrown AppErrors, Zod
 * validation failures, and anything unexpected. Production responses never
 * expose stack traces or internal details.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const body: ApiErrorBody = { error: { code: ERROR_CODES.INTERNAL_ERROR, message: '' } };

  if (err instanceof ZodError) {
    body.error = {
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Request validation failed',
      details: err.flatten().fieldErrors,
    };
    return res.status(400).json(body);
  }

  if (err instanceof AppError) {
    body.error = { code: err.code, message: err.message, details: err.details };
    return res.status(err.statusCode).json(body);
  }

  // Body-parser malformed JSON
  if (err instanceof SyntaxError && 'body' in err) {
    body.error = { code: ERROR_CODES.VALIDATION_ERROR, message: 'Malformed JSON body' };
    return res.status(400).json(body);
  }

  req.log?.error({ err }, 'Unhandled error');
  if (!req.log) logger.error({ err }, 'Unhandled error');

  body.error = {
    code: ERROR_CODES.INTERNAL_ERROR,
    message: isProd ? 'Something went wrong' : (err as Error)?.message ?? 'Something went wrong',
  };
  return res.status(500).json(body);
}
