import { Router } from 'express';
import { z } from 'zod';
import { PRIORITIES, type SlaTargetDto } from '@helpdesk/shared';
import { requireAdmin, requireStaff } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { ah } from '../../utils/async-handler';
import { prisma } from '../../utils/prisma';
import { errors } from '../../utils/errors';

const updateSchema = z.object({
  firstResponseMinutes: z.number().int().positive().max(7 * 24 * 60),
  resolutionMinutes: z.number().int().positive().max(30 * 24 * 60),
});
const priorityParam = z.object({ priority: z.enum(PRIORITIES) });

export const slaRouter = Router();
slaRouter.use(requireStaff);

/** GET /sla-targets — staff can read; affects newly created tickets only. */
slaRouter.get(
  '/',
  ah(async (_req, res) => {
    const rows = await prisma.slaTarget.findMany({ orderBy: { firstResponseMinutes: 'asc' } });
    const dto: SlaTargetDto[] = rows.map((r) => ({
      priority: r.priority,
      firstResponseMinutes: r.firstResponseMinutes,
      resolutionMinutes: r.resolutionMinutes,
    }));
    res.json(dto);
  }),
);

/** PATCH /sla-targets/:priority — admin configures targets (audited). */
slaRouter.patch(
  '/:priority',
  requireAdmin,
  validate(priorityParam, 'params'),
  validate(updateSchema),
  ah(async (req, res) => {
    const { priority } = req.params as { priority: string };
    const input = req.body as z.infer<typeof updateSchema>;
    const existing = await prisma.slaTarget.findUnique({
      where: { priority: priority as never },
    });
    if (!existing) throw errors.notFound('SLA target');

    const updated = await prisma.$transaction(async (tx) => {
      const t = await tx.slaTarget.update({
        where: { priority: priority as never },
        data: input,
      });
      await tx.auditLog.create({
        data: {
          actorId: req.user!.id,
          action: 'SLA_TARGET_UPDATED',
          entityType: 'TICKET',
          entityId: null,
          metadata: {
            priority,
            from: {
              firstResponseMinutes: existing.firstResponseMinutes,
              resolutionMinutes: existing.resolutionMinutes,
            },
            to: input,
          },
        },
      });
      return t;
    });
    res.json(updated);
  }),
);
