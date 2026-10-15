import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  paginationSchema,
  ROLES,
  updateProfileSchema,
  type Paginated,
  type Role,
  type UpdateProfileInput,
  type UserDto,
} from '@helpdesk/shared';
import { prisma } from '../../utils/prisma';
import { errors } from '../../utils/errors';
import { hashPassword, verifyPassword } from '../../utils/password';
import { revokeAllSessions, toUserDto } from '../auth/auth.service';

type AuthUser = NonNullable<Request['user']>;

const listQuerySchema = paginationSchema.extend({
  role: z.enum(ROLES).optional(),
  accountStatus: z.enum(['ACTIVE', 'DISABLED']).optional(),
  search: z.string().trim().max(120).optional(),
});

/**
 * GET /users — ADMIN sees everyone with filters; staff (agents) get only the
 * active staff list for the assign dropdown; customers get 403 at the router.
 */
export async function listUsers(user: AuthUser, query: unknown): Promise<Paginated<UserDto>> {
  const q = listQuerySchema.parse(query);

  const where: Prisma.UserWhereInput =
    user.role === 'ADMIN'
      ? {
          ...(q.role ? { role: q.role } : {}),
          ...(q.accountStatus ? { accountStatus: q.accountStatus } : {}),
          ...(q.search
            ? {
                OR: [
                  { name: { contains: q.search, mode: 'insensitive' } },
                  { email: { contains: q.search, mode: 'insensitive' } },
                ],
              }
            : {}),
        }
      : { role: { in: ['AGENT', 'ADMIN'] }, accountStatus: 'ACTIVE' };

  const [total, rows] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);
  return { data: rows.map(toUserDto), page: q.page, pageSize: q.pageSize, total };
}

export async function getUser(user: AuthUser, id: string): Promise<UserDto> {
  if (user.role !== 'ADMIN' && user.id !== id) throw errors.notFound('User');
  const found = await prisma.user.findUnique({ where: { id } });
  if (!found) throw errors.notFound('User');
  return toUserDto(found);
}

/** Profile self-update: name, and password change gated on current password. */
export async function updateProfile(user: AuthUser, id: string, input: UpdateProfileInput) {
  if (user.id !== id && user.role !== 'ADMIN') throw errors.notFound('User');
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw errors.notFound('User');

  const data: Prisma.UserUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;

  if (input.newPassword !== undefined) {
    if (!input.currentPassword || !(await verifyPassword(input.currentPassword, target.passwordHash))) {
      throw errors.badRequest('Current password is incorrect');
    }
    data.passwordHash = await hashPassword(input.newPassword);
  }

  const updated = await prisma.user.update({ where: { id }, data });
  if (input.newPassword) await revokeAllSessions(id, user.id); // force re-login
  return toUserDto(updated);
}

export async function updateRole(user: AuthUser, id: string, role: Role) {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw errors.notFound('User');
  if (target.id === user.id) throw errors.badRequest('You cannot change your own role');

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({ where: { id }, data: { role } });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: 'USER_ROLE_CHANGED',
        entityType: 'USER',
        entityId: id,
        metadata: { from: target.role, to: role },
      },
    });
    return u;
  });
  await revokeAllSessions(id, user.id); // role changed → re-auth
  return toUserDto(updated);
}

export async function updateAccountStatus(user: AuthUser, id: string, accountStatus: 'ACTIVE' | 'DISABLED') {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw errors.notFound('User');
  if (target.id === user.id) throw errors.badRequest('You cannot change your own account status');

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({ where: { id }, data: { accountStatus } });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: 'USER_STATUS_CHANGED',
        entityType: 'USER',
        entityId: id,
        metadata: { from: target.accountStatus, to: accountStatus },
      },
    });
    return u;
  });
  if (accountStatus === 'DISABLED') await revokeAllSessions(id, user.id);
  return toUserDto(updated);
}
