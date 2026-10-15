import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';

/**
 * Request validation middleware. Parses and replaces req.body / req.query /
 * req.params with the *parsed* values (coerced, defaulted, stripped).
 * Throws ZodError → handled by error-handler → 400 VALIDATION_ERROR.
 */
export function validate(schema: ZodType, source: 'body' | 'query' | 'params' = 'body'): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.parse(req[source]);
    if (source === 'query') {
      // req.query is a getter in Express 5; on Express 4 it is writable —
      // assignment is safe on both because we never rely on the raw object.
      Object.defineProperty(req, 'query', { value: parsed, writable: true });
    } else {
      req[source] = parsed;
    }
    next();
  };
}
