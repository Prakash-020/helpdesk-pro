/**
 * Hand-maintained OpenAPI 3.0 spec. Kept close to the code rather than
 * generated — small enough to review in diffs, complete enough for consumers
 * and interview walkthroughs. Served at GET /api/docs.json + /api/docs.
 */
export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'HelpDesk Pro API',
    version: '1.0.0',
    description:
      'Customer support ticket platform. Session-cookie auth (opaque, hashed server-side), ' +
      'role-scoped resources (CUSTOMER/AGENT/ADMIN), uniform error envelope ' +
      '`{ error: { code, message, details? } }`. All mutation endpoints enforce ' +
      'server-side authorization — internal notes never reach customers.',
  },
  servers: [{ url: '/api/v1' }],
  tags: [
    { name: 'auth' }, { name: 'tickets' }, { name: 'comments' }, { name: 'attachments' },
    { name: 'categories' }, { name: 'users' }, { name: 'notifications' },
    { name: 'sla' }, { name: 'audit' }, { name: 'analytics' },
  ],
  paths: {
    '/auth/register': {
      post: {
        tags: ['auth'], summary: 'Register a customer account',
        requestBody: req(['name', 'email', 'password'], {
          name: { type: 'string' }, email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
        }),
        responses: {
          '201': { description: 'Created; HttpOnly `hp_session` cookie set' },
          '409': err('CONFLICT', 'Email already registered'),
          '400': err('VALIDATION_ERROR'),
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['auth'], summary: 'Log in (rate-limited)',
        requestBody: req(['email', 'password'], {
          email: { type: 'string', format: 'email' }, password: { type: 'string' },
        }),
        responses: {
          '200': { description: 'Logged in; session cookie set' },
          '401': err('UNAUTHENTICATED', 'Uniform message — no user enumeration'),
          '429': { description: 'Rate limited' },
        },
      },
    },
    '/auth/logout': { post: { tags: ['auth'], summary: 'Revoke the current session', responses: { '200': { description: 'ok' } } } },
    '/auth/me': {
      get: {
        tags: ['auth'], summary: 'Current user (requires session cookie)',
        responses: { '200': { description: '{ user: UserDto }' }, '401': err('UNAUTHENTICATED | SESSION_EXPIRED') },
      },
    },
    '/tickets': {
      get: {
        tags: ['tickets'], summary: 'List tickets — role-scoped + filters + pagination',
        parameters: [
          q('page'), q('pageSize'), q('status'), q('priority'), q('categoryId'),
          q('assigneeId'), { name: 'assignee', in: 'query', schema: { type: 'string', enum: ['me'] } },
          q('search'), { name: 'sla', in: 'query', schema: { type: 'string', enum: ['breached'] } },
          q('sort'), q('order'), q('from'), q('to'),
        ],
        responses: { '200': { description: 'Paginated<TicketSummaryDto>' }, '401': err('UNAUTHENTICATED') },
      },
      post: {
        tags: ['tickets'], summary: 'Create a ticket (customers)',
        requestBody: req(['subject', 'description', 'categoryId', 'priority'], {
          subject: { type: 'string', minLength: 4, maxLength: 160 },
          description: { type: 'string', minLength: 10 },
          categoryId: { type: 'string', format: 'uuid' },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
        }),
        responses: { '201': { description: 'TicketDto (SLA due dates snapshotted)' }, '401': err('UNAUTHENTICATED') },
      },
    },
    '/tickets/{id}': {
      get: {
        tags: ['tickets'], summary: 'Ticket detail — 404 when out of scope (no existence leak)',
        parameters: [p('id')],
        responses: { '200': { description: 'TicketDto' }, '404': err('NOT_FOUND') },
      },
      patch: {
        tags: ['tickets'], summary: 'Staff metadata edit (subject/description/category/priority) — audited diff',
        parameters: [p('id')],
        responses: { '200': { description: 'TicketDto' }, '403': err('FORBIDDEN') },
      },
      delete: {
        tags: ['tickets'], summary: 'Soft-delete (ADMIN) — deletedAt flag, audit preserved',
        parameters: [p('id')],
        responses: { '200': { description: 'ok' }, '403': err('FORBIDDEN') },
      },
    },
    '/tickets/{id}/status': {
      patch: {
        tags: ['tickets'], summary: 'State-machine transition (validates ALLOWED_TRANSITIONS; customers only reopen/confirm-close own)',
        parameters: [p('id')],
        requestBody: req(['status'], { status: { type: 'string', enum: ['OPEN','IN_PROGRESS','WAITING_FOR_CUSTOMER','RESOLVED','CLOSED'] } }),
        responses: { '200': { description: 'TicketDto' }, '409': err('FORBIDDEN_TRANSITION') },
      },
    },
    '/tickets/{id}/assignment': {
      patch: {
        tags: ['tickets'], summary: 'Assign/reassign (staff; auto OPEN→IN_PROGRESS, notifies assignee)',
        parameters: [p('id')],
        requestBody: req(['assigneeId'], { assigneeId: { type: ['string','null'], format: 'uuid' } }),
        responses: { '200': { description: 'TicketDto' }, '403': err('FORBIDDEN') },
      },
    },
    '/tickets/{id}/comments': {
      get: { tags: ['comments'], summary: 'Thread — internal notes filtered out for customers', parameters: [p('id')], responses: { '200': { description: 'CommentDto[]' } } },
      post: { tags: ['comments'], summary: 'Reply / internal note (isInternal forced false for customers)', parameters: [p('id')], responses: { '201': { description: 'CommentDto' }, '403': err('FORBIDDEN') } },
    },
    '/tickets/{id}/attachments': {
      get: { tags: ['attachments'], summary: 'List attachments', parameters: [p('id')], responses: { '200': { description: 'AttachmentDto[]' } } },
      post: { tags: ['attachments'], summary: 'Upload (multipart, field `file`, ≤10MB, MIME allowlist)', parameters: [p('id'), q('commentId')], responses: { '201': { description: 'AttachmentDto' } } },
    },
    '/comments/{id}': {
      patch: { tags: ['comments'], summary: 'Edit (author or admin) — audited', parameters: [p('id')], responses: { '200': { description: 'CommentDto' }, '403': err('FORBIDDEN') } },
      delete: { tags: ['comments'], summary: 'Delete (author or admin) — audited', parameters: [p('id')], responses: { '200': { description: 'ok' } } },
    },
    '/attachments/{id}': {
      get: { tags: ['attachments'], summary: 'Download (streams; authorized on parent ticket)', parameters: [p('id')], responses: { '200': { description: 'file stream' }, '404': err('NOT_FOUND') } },
      delete: { tags: ['attachments'], summary: 'Delete (uploader or admin)', parameters: [p('id')], responses: { '200': { description: 'ok' }, '403': err('FORBIDDEN') } },
    },
    '/categories': {
      get: { tags: ['categories'], summary: 'List (active only for non-admin)' },
      post: { tags: ['categories'], summary: 'Create (ADMIN)', requestBody: req(['name'], { name: { type: 'string' }, description: { type: 'string' } }), responses: { '201': { description: 'CategoryDto' }, '409': err('CONFLICT') } },
    },
    '/categories/{id}': {
      patch: { tags: ['categories'], summary: 'Update (ADMIN, incl. isActive toggle)', parameters: [p('id')] },
      delete: { tags: ['categories'], summary: 'Delete (ADMIN) — 409 when referenced by tickets', parameters: [p('id')], responses: { '409': err('CONFLICT', 'Deactivate instead') } },
    },
    '/users': {
      get: { tags: ['users'], summary: 'List (ADMIN all; staff get active agents only)', parameters: [q('page'), q('role'), q('search'), q('accountStatus')], responses: { '200': { description: 'Paginated<UserDto>' }, '403': err('FORBIDDEN') } },
    },
    '/users/{id}': {
      get: { tags: ['users'], summary: 'Get (self or admin)', parameters: [p('id')] },
      patch: { tags: ['users'], summary: 'Profile update (name; password change gated on current)', parameters: [p('id')] },
    },
    '/users/{id}/role': { patch: { tags: ['users'], summary: 'Change role (ADMIN; revokes sessions)', parameters: [p('id')] } },
    '/users/{id}/status': { patch: { tags: ['users'], summary: 'Activate/disable (ADMIN; revokes sessions)', parameters: [p('id')] } },
    '/notifications': {
      get: { tags: ['notifications'], summary: 'List mine (paginated)' },
    },
    '/notifications/unread-count': { get: { tags: ['notifications'], summary: 'Unread badge count' } },
    '/notifications/read-all': { patch: { tags: ['notifications'], summary: 'Mark all read' } },
    '/notifications/{id}/read': { patch: { tags: ['notifications'], summary: 'Mark one read (idempotent)', parameters: [p('id')] } },
    '/sla-targets': {
      get: { tags: ['sla'], summary: 'SLA targets per priority (staff)' },
    },
    '/sla-targets/{priority}': {
      patch: { tags: ['sla'], summary: 'Update target (ADMIN; applies to new tickets)', parameters: [p('priority')], responses: { '200': { description: 'SlaTarget' }, '403': err('FORBIDDEN') } },
    },
    '/audit-logs': {
      get: { tags: ['audit'], summary: 'Append-only audit trail (ADMIN) — filterable + paginated', parameters: [q('page'), q('action'), q('entityType'), q('entityId'), q('actorId'), q('from'), q('to')], responses: { '200': { description: 'Paginated<AuditLogDto>' }, '403': err('FORBIDDEN') } },
    },
    '/analytics/overview': { get: { tags: ['analytics'], summary: 'Dashboard aggregates (staff, role-scoped)' } },
    '/analytics/tickets': { get: { tags: ['analytics'], summary: 'Volume + breakdowns (staff)', parameters: [q('days')] } },
    '/analytics/agents': { get: { tags: ['analytics'], summary: 'Per-agent workload/performance (ADMIN)' } },
  },
  components: {
    securitySchemes: {
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'hp_session' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', enum: ['VALIDATION_ERROR','UNAUTHENTICATED','SESSION_EXPIRED','FORBIDDEN','FORBIDDEN_TRANSITION','NOT_FOUND','CONFLICT','RATE_LIMITED','INTERNAL_ERROR'] },
              message: { type: 'string' },
              details: { type: 'object', nullable: true },
            },
          },
        },
      },
    },
  },
  security: [{ cookieAuth: [] }],
} as const;

function q(name: string) {
  return { name, in: 'query', schema: { type: 'string' } };
}
function p(name: string) {
  return { name, in: 'path', required: true, schema: { type: 'string' } };
}
function req(required: string[], properties: Record<string, unknown>) {
  return { required: true, content: { 'application/json': { schema: { type: 'object', required, properties } } } };
}
function err(code: string, note?: string) {
  return { description: `Error — code: ${code}${note ? ` (${note})` : ''}` };
}
