/**
 * Domain enums — single source of truth shared by API and web client.
 * Keep these identical to the Prisma enums in apps/api/prisma/schema.prisma.
 */

export const ROLES = ['CUSTOMER', 'AGENT', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const ACCOUNT_STATUSES = ['ACTIVE', 'DISABLED'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const TICKET_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_FOR_CUSTOMER',
  'RESOLVED',
  'CLOSED',
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const NOTIFICATION_TYPES = [
  'TICKET_ASSIGNED',
  'TICKET_REPLY',
  'STATUS_CHANGED',
  'SLA_WARNING',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const AUDIT_ACTIONS = [
  'TICKET_CREATED',
  'TICKET_UPDATED',
  'STATUS_CHANGED',
  'PRIORITY_CHANGED',
  'ASSIGNED',
  'COMMENT_ADDED',
  'CATEGORY_CREATED',
  'CATEGORY_UPDATED',
  'CATEGORY_DELETED',
  'USER_UPDATED',
  'USER_ROLE_CHANGED',
  'USER_STATUS_CHANGED',
  'SESSION_REVOKED',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const ENTITY_TYPES = ['TICKET', 'USER', 'CATEGORY', 'COMMENT', 'SESSION'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

/* ---------- Display labels (UI only) ---------- */

export const ROLE_LABELS: Record<Role, string> = {
  CUSTOMER: 'Customer',
  AGENT: 'Agent',
  ADMIN: 'Admin',
};

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  WAITING_FOR_CUSTOMER: 'Waiting for customer',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

/* ---------- Ticket state machine ---------- */

/**
 * Allowed target statuses for each current status.
 * The API re-validates every transition server-side; the client uses this
 * only to render which actions a user may attempt.
 */
export const ALLOWED_TRANSITIONS: Readonly<Record<TicketStatus, readonly TicketStatus[]>> = {
  OPEN: ['IN_PROGRESS', 'RESOLVED'],
  IN_PROGRESS: ['WAITING_FOR_CUSTOMER', 'RESOLVED'],
  WAITING_FOR_CUSTOMER: ['IN_PROGRESS', 'RESOLVED'],
  RESOLVED: ['CLOSED', 'OPEN'],
  CLOSED: [],
};

/** Resolved tickets may be reopened within this window (calendar days). */
export const REOPEN_WINDOW_DAYS = 14;
