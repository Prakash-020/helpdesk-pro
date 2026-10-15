import type { CategoryDto, CategoryInput } from '@helpdesk/shared';
import { prisma } from '../../utils/prisma';
import { errors } from '../../utils/errors';

export function toCategoryDto(c: {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  _count?: { tickets: number };
}): CategoryDto {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    isActive: c.isActive,
    ...(c._count ? { ticketCount: c._count.tickets } : {}),
  };
}

/** Active categories for forms (all callers); admin gets the full list. */
export async function list(includeInactive = false) {
  const rows = await prisma.category.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { name: 'asc' },
    include: { _count: { select: { tickets: true } } },
  });
  return rows.map(toCategoryDto);
}

export async function create(input: CategoryInput, actorId: string) {
  const existing = await prisma.category.findUnique({ where: { name: input.name } });
  if (existing) throw errors.conflict('A category with this name already exists');
  const created = await prisma.category.create({
    data: { name: input.name, description: input.description ?? null },
  });
  await prisma.auditLog.create({
    data: {
      actorId,
      action: 'CATEGORY_CREATED',
      entityType: 'CATEGORY',
      entityId: created.id,
      metadata: { name: created.name },
    },
  });
  return toCategoryDto(created);
}

export async function update(id: string, input: Partial<CategoryInput & { isActive: boolean }>, actorId: string) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw errors.notFound('Category');
  if (input.name && input.name !== existing.name) {
    const clash = await prisma.category.findUnique({ where: { name: input.name } });
    if (clash) throw errors.conflict('A category with this name already exists');
  }
  const updated = await prisma.category.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId,
      action: 'CATEGORY_UPDATED',
      entityType: 'CATEGORY',
      entityId: id,
      metadata: { diff: input },
    },
  });
  return toCategoryDto(updated);
}

/**
 * Safe delete: a category referenced by tickets is never hard-deleted —
 * return 409 with guidance to deactivate instead.
 */
export async function remove(id: string, actorId: string) {
  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { tickets: true } } },
  });
  if (!category) throw errors.notFound('Category');
  if (category._count.tickets > 0) {
    throw errors.conflict(
      `Category is used by ${category._count.tickets} ticket(s) — deactivate it instead`,
      { ticketCount: category._count.tickets },
    );
  }
  await prisma.$transaction([
    prisma.category.delete({ where: { id } }),
    prisma.auditLog.create({
      data: {
        actorId,
        action: 'CATEGORY_DELETED',
        entityType: 'CATEGORY',
        entityId: id,
        metadata: { name: category.name },
      },
    }),
  ]);
  return { ok: true };
}
