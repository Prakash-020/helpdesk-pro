import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as controller from './auth.controller';
import { requireAuth } from '../../middleware/auth';
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

authRouter.post('/register', credentialsLimiter, ah(controller.register));
authRouter.post('/login', credentialsLimiter, ah(controller.login));
authRouter.post('/logout', ah(controller.logout));
authRouter.get('/me', requireAuth, controller.me);
