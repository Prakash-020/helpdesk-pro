import { Router } from 'express';
import { z } from 'zod';
import {
  assignTicketSchema,
  createCommentSchema,
  createTicketSchema,
  ticketListQuerySchema,
  updateStatusSchema,
  updateTicketSchema,
} from '@helpdesk/shared';
import { requireAuth, requireAdmin, requireStaff } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { ah } from '../../utils/async-handler';
import * as controller from './tickets.controller';

const idParam = z.object({ id: z.string().uuid() });

export const ticketsRouter = Router();

// Every ticket route requires authentication; scoping happens in the service.
ticketsRouter.use(requireAuth);

ticketsRouter.get('/', validate(ticketListQuerySchema, 'query'), ah(controller.list));
ticketsRouter.post('/', validate(createTicketSchema), ah(controller.create));
ticketsRouter.get('/:id', validate(idParam, 'params'), ah(controller.get));
ticketsRouter.patch(
  '/:id',
  requireStaff,
  validate(idParam, 'params'),
  validate(updateTicketSchema),
  ah(controller.update),
);
ticketsRouter.patch(
  '/:id/status',
  validate(idParam, 'params'),
  validate(updateStatusSchema),
  ah(controller.updateStatus),
);
ticketsRouter.patch(
  '/:id/assignment',
  requireStaff,
  validate(idParam, 'params'),
  validate(assignTicketSchema),
  ah(controller.assign),
);
ticketsRouter.get('/:id/comments', validate(idParam, 'params'), ah(controller.listComments));
ticketsRouter.post(
  '/:id/comments',
  validate(idParam, 'params'),
  validate(createCommentSchema),
  ah(controller.addComment),
);
ticketsRouter.delete('/:id', requireAdmin, validate(idParam, 'params'), ah(controller.remove));

/** Item-level comment ops live under /comments. */
export const commentsRouter = Router();
commentsRouter.use(requireAuth);
commentsRouter.patch(
  '/:id',
  validate(idParam, 'params'),
  validate(createCommentSchema.pick({ body: true })),
  ah(controller.updateComment),
);
commentsRouter.delete('/:id', validate(idParam, 'params'), ah(controller.deleteComment));
