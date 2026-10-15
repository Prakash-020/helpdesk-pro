import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ERROR_CODES } from '@helpdesk/shared';
import { isTest, webOrigins } from '../config/env';

/**
 * CSRF defence for the cookie-authenticated API. SameSite=Lax already blocks
 * cross-site POSTs in modern browsers; this is defense-in-depth: if an Origin
 * or Referer header is present on a mutating request it must be allowlisted.
 * Header-absent requests (curl, server-to-server, same-origin GETs) pass.
 */
export const originCheck: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  if (isTest || req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  const source = req.headers.origin ?? req.headers.referer;
  if (!source) return next();

  try {
    const { origin } = new URL(source);
    if (webOrigins.includes(origin)) return next();
  } catch {
    // unparsable → reject below
  }

  res.status(403).json({
    error: { code: ERROR_CODES.FORBIDDEN, message: 'Origin not allowed' },
  });
};
