import type { Request, Response } from 'express';
import { loginSchema, registerSchema } from '@helpdesk/shared';
import { isProd } from '../../config/env';
import { SESSION_COOKIE, SESSION_TTL_MS } from '../../utils/session-token';
import * as authService from './auth.service';

function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS,
  });
}

function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/' });
}

export async function register(req: Request, res: Response) {
  const input = registerSchema.parse(req.body);
  const { user, token } = await authService.register(input, req.ip, req.headers['user-agent']);
  setSessionCookie(res, token);
  res.status(201).json({ user: authService.toUserDto(user) });
}

export async function login(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);
  const { user, token } = await authService.login(input, req.ip, req.headers['user-agent']);
  setSessionCookie(res, token);
  res.json({ user: authService.toUserDto(user) });
}

export async function logout(req: Request, res: Response) {
  await authService.logout(req.sessionId);
  clearSessionCookie(res);
  res.json({ ok: true });
}

export function me(req: Request, res: Response) {
  res.json({ user: req.user }); // attachUser+requireAuth guarantee shape
}
