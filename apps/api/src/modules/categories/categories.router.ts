import { Router } from 'express';
import { z } from 'zod';
import { categorySchema } from '@helpdesk/shared';
import { requireAdmin, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { ah } from '../../utils/async-handler';
import * as service from './categories.service';

const idParam = z.object({ id: z.string().uuid() });
const updateSchema = categorySchema.partial().extend({ isActive: z.boolean().optional() });

export const categoriesRouter = Router();
categoriesRouter.use(requireAuth);

categoriesRouter.get(
  '/',
  ah(async (req, res) => res.json(await service.list(req.user!.role === 'ADMIN'))),
);
categoriesRouter.post('/', requireAdmin, validate(categorySchema), ah(async (req, res) =>
  res.status(201).json(await service.create(req.body, req.user!.id))));
categoriesRouter.patch(
  '/:id',
  requireAdmin,
  validate(idParam, 'params'),
  validate(updateSchema),
  ah(async (req, res) => res.json(await service.update(req.params.id as string, req.body, req.user!.id))),
);
categoriesRouter.delete(
  '/:id',
  requireAdmin,
  validate(idParam, 'params'),
  ah(async (req, res) => res.json(await service.remove(req.params.id as string, req.user!.id))),
);
