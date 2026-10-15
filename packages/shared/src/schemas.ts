import { z } from 'zod';
import { PRIORITIES, ROLES, TICKET_STATUSES } from './enums';

/**
 * Wire-boundary validation schemas. The API uses them for request validation;
 * the web client reuses them for React Hook Form resolvers.
 */

/* ---------- Auth ---------- */

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters');

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  currentPassword: z.string().optional(),
  newPassword: passwordSchema.optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/* ---------- Tickets ---------- */

export const createTicketSchema = z.object({
  subject: z.string().trim().min(4).max(160),
  description: z.string().trim().min(10).max(10_000),
  categoryId: z.string().uuid(),
  priority: z.enum(PRIORITIES).default('MEDIUM'),
});
export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const updateTicketSchema = z.object({
  subject: z.string().trim().min(4).max(160).optional(),
  description: z.string().trim().min(10).max(10_000).optional(),
  categoryId: z.string().uuid().optional(),
  priority: z.enum(PRIORITIES).optional(),
});
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

export const updateStatusSchema = z.object({
  status: z.enum(TICKET_STATUSES),
});
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;

export const assignTicketSchema = z.object({
  /** null = unassign (returns ticket to the pool) */
  assigneeId: z.string().uuid().nullable(),
});
export type AssignTicketInput = z.infer<typeof assignTicketSchema>;

export const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(10_000),
  /** Only staff may send true; server forces false for customers. */
  isInternal: z.boolean().default(false),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

/* ---------- Categories / Users ---------- */

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).nullish(),
});
export type CategoryInput = z.infer<typeof categorySchema>;

export const updateUserRoleSchema = z.object({ role: z.enum(ROLES) });
export const updateUserStatusSchema = z.object({
  accountStatus: z.enum(['ACTIVE', 'DISABLED']),
});

/* ---------- List query params ---------- */

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export type PaginationInput = z.infer<typeof paginationSchema>;

export const ticketListQuerySchema = paginationSchema.extend({
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  categoryId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  /** "me" shorthand resolves to the current user's id */
  assignee: z.literal('me').optional(),
  search: z.string().trim().max(120).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sla: z.enum(['breached']).optional(),
  sort: z.enum(['createdAt', 'updatedAt', 'priority', 'status']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type TicketListQuery = z.infer<typeof ticketListQuerySchema>;
