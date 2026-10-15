import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { ah } from '../../utils/async-handler';
import * as service from './notifications.service';

const idParam = z.object({ id: z.string().uuid() });

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get('/', ah(async (req, res) => res.json(await service.listMine(req.user!, req.query))));
notificationsRouter.get('/unread-count', ah(async (req, res) => res.json(await service.unreadCount(req.user!))));
notificationsRouter.patch('/read-all', ah(async (req, res) => res.json(await service.markAllRead(req.user!))));
notificationsRouter.patch(
  '/:id/read',
  validate(idParam, 'params'),
  ah(async (req, res) => res.json(await service.markRead(req.user!, req.params.id as string))),
);
