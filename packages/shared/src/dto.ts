import type {
  AccountStatus,
  AuditAction,
  EntityType,
  NotificationType,
  Priority,
  Role,
  TicketStatus,
} from './enums';

/* ---------- API envelope ---------- */

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface HealthDto {
  status: 'ok';
  uptime: number;
  timestamp: string;
}

/* ---------- DTOs (already stripped — safe for the wire) ---------- */

export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: Role;
  accountStatus: AccountStatus;
  createdAt: string;
}

export interface CategoryDto {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  ticketCount?: number;
}

export interface TicketSummaryDto {
  id: string;
  ticketNumber: string;
  subject: string;
  status: TicketStatus;
  priority: Priority;
  category: Pick<CategoryDto, 'id' | 'name'> | null;
  customer: Pick<UserDto, 'id' | 'name'>;
  assignee: Pick<UserDto, 'id' | 'name'> | null;
  commentCount: number;
  responseDueAt: string | null;
  resolutionDueAt: string | null;
  slaBreached: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TicketDto extends Omit<TicketSummaryDto, 'commentCount'> {
  description: string;
  customer: Pick<UserDto, 'id' | 'name' | 'email'>;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
}

export interface CommentDto {
  id: string;
  ticketId: string;
  body: string;
  /** Always false when serialized for a CUSTOMER — internal notes never leak. */
  isInternal: boolean;
  author: Pick<UserDto, 'id' | 'name' | 'role'>;
  attachments: AttachmentDto[];
  createdAt: string;
}

export interface AttachmentDto {
  id: string;
  ticketId: string;
  commentId: string | null;
  uploaderId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface NotificationDto {
  id: string;
  type: NotificationType;
  message: string;
  ticketId: string | null;
  ticketNumber: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface AuditLogDto {
  id: string;
  action: AuditAction;
  entityType: EntityType;
  entityId: string | null; // null for system-level actions (e.g. SLA config)
  actor: Pick<UserDto, 'id' | 'name' | 'role'> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

/* ---------- Analytics ---------- */

export interface SlaTargetDto {
  priority: Priority;
  firstResponseMinutes: number;
  resolutionMinutes: number;
}

export interface AnalyticsOverviewDto {
  total: number;
  open: number;
  inProgress: number;
  waitingForCustomer: number;
  resolved: number;
  closed: number;
  overdue: number;
  avgFirstResponseMinutes: number | null;
  avgResolutionMinutes: number | null;
}
