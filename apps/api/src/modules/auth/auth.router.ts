import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as controller from './auth.controller';
import { requireAuth } from '../../middleware/auth';
import { isTest } from '../../config/env';
import { ah } from '../../utils/async-handler';

/**
 * Credential endpoints are rate-limited per IP — slows credential stuffing
 * without a third-party service. 20 attempts / 15 min.
 */
const credentialsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts — try again later' } },
});

export const authRouter = Router();

// Credential endpoints are rate-limited in production; tests drive many
// logins per run, so the limiter is bypassed under NODE_ENV=test.
const guard = isTest ? [] : [credentialsLimiter];
authRouter.post('/register', ...guard, ah(controller.register));
authRouter.post('/login', ...guard, ah(controller.login));
authRouter.post('/logout', ah(controller.logout));
authRouter.get('/me', requireAuth, controller.me);
