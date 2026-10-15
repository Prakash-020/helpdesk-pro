import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Role } from '@helpdesk/shared';
import { errors } from '../utils/errors';
import { resolveSession } from '../modules/auth/auth.service';
import { SESSION_COOKIE } from '../utils/session-token';

/**
 * Non-blocking session resolution: if a valid hp_session cookie exists,
 * attaches req.user + req.sessionId. Never rejects — requireAuth does that.
 */
export const attachUser: RequestHandler = async (req, _res, next) => {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!token) return next();

  const session = await resolveSession(token);
  if (session) {
    req.user = session.user;
    req.sessionId = session.sessionId;
  }
  next();
};

/** Hard gate: requires an authenticated, ACTIVE user. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) {
    const hadCookie = Boolean(req.cookies?.[SESSION_COOKIE]);
    return next(hadCookie ? errors.sessionExpired() : errors.unauthenticated());
  }
  next();
};

/** Role gate. Usage: requireRole('AGENT', 'ADMIN'). Always after requireAuth. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(errors.unauthenticated());
    if (!roles.includes(req.user.role)) return next(errors.forbidden());
    next();
  };
}

export const requireStaff = requireRole('AGENT', 'ADMIN');
export const requireAdmin = requireRole('ADMIN');
