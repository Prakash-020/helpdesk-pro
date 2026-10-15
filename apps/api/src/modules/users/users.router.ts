import { Router } from 'express';
import { z } from 'zod';
import {
  updateProfileSchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
} from '@helpdesk/shared';
import { requireAuth, requireAdmin, requireStaff } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { ah } from '../../utils/async-handler';
import * as service from './users.service';

const idParam = z.object({ id: z.string().uuid() });

export const usersRouter = Router();
usersRouter.use(requireAuth);

// Staff need the agents list for assignment; customers get 403.
usersRouter.get('/', requireStaff, ah(async (req, res) => res.json(await service.listUsers(req.user!, req.query))));
usersRouter.get('/:id', validate(idParam, 'params'), ah(async (req, res) => res.json(await service.getUser(req.user!, req.params.id as string))));
usersRouter.patch(
  '/:id',
  validate(idParam, 'params'),
  validate(updateProfileSchema),
  ah(async (req, res) => res.json(await service.updateProfile(req.user!, req.params.id as string, req.body))),
);
usersRouter.patch(
  '/:id/role',
  requireAdmin,
  validate(idParam, 'params'),
  validate(updateUserRoleSchema),
  ah(async (req, res) => res.json(await service.updateRole(req.user!, req.params.id as string, req.body.role))),
);
usersRouter.patch(
  '/:id/status',
  requireAdmin,
  validate(idParam, 'params'),
  validate(updateUserStatusSchema),
  ah(async (req, res) =>
    res.json(await service.updateAccountStatus(req.user!, req.params.id as string, req.body.accountStatus)),
  ),
);
