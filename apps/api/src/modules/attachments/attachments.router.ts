import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { ah } from '../../utils/async-handler';
import * as service from './attachments.service';

const idParam = z.object({ id: z.string().uuid() });
const uploadQuery = z.object({ commentId: z.string().uuid().optional() });

/** Mounted twice: /tickets/:id/attachments (collection) and /attachments/:id (item). */
export const ticketAttachmentsRouter = Router({ mergeParams: true });
ticketAttachmentsRouter.use(requireAuth);

ticketAttachmentsRouter.get(
  '/',
  ah(async (req, res) => res.json(await service.listForTicket(req.user!, req.params.id as string))),
);
ticketAttachmentsRouter.post(
  '/',
  service.upload.single('file'),
  validate(uploadQuery, 'query'),
  ah(async (req, res) =>
    res
      .status(201)
      .json(
        await service.uploadAttachment(
          req.user!,
          req.params.id as string,
          req.file,
          (req.query as { commentId?: string }).commentId,
        ),
      ),
  ),
);

export const attachmentsRouter = Router();
attachmentsRouter.use(requireAuth);

attachmentsRouter.get(
  '/:id',
  validate(idParam, 'params'),
  ah(async (req, res) => {
    await service.download(req.user!, req.params.id as string, res);
  }),
);
attachmentsRouter.delete(
  '/:id',
  validate(idParam, 'params'),
  ah(async (req, res) => res.json(await service.remove(req.user!, req.params.id as string))),
);
