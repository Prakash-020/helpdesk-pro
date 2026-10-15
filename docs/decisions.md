# Engineering Decision Log

ADR-lite format: Context → Decision → Consequences. Significant choices only.
Newest entries appended. Status: Accepted unless noted.

---

## ADR-001 — Server-managed session cookies over JWT

**Context:** Auth needed for REST + WebSocket; spec requires secure sessions.
**Decision:** Opaque 256-bit session token in `HttpOnly; Secure; SameSite=Lax`
cookie; only SHA-256 hash persisted (`Session.hashedSessionToken`); expiry +
`revokedAt`; fresh token on every login.
**Consequences:** Instant revocation (logout/disable works immediately), no
token-refresh machinery, no token readable by JS. Trade-off: server-side
lookup per request (indexed, cheap) and CSRF handling (SameSite + Origin
check covers it).

## ADR-002 — Single `User` table with `role` enum

**Context:** Could model Customer/Agent/Admin as separate tables.
**Decision:** One `users` table, `role` + `accountStatus` enums; all
authorization is `req.user.role` + ownership checks in the service layer.
**Consequences:** Simpler auth, one login surface, role changes are a column
update (admin can promote/demote). Permission logic centralized — and tested.

## ADR-003 — npm workspaces monorepo: `apps/web`, `apps/api`, `packages/shared`

**Context:** Spec requires modular monorepo with shared contracts.
**Decision:** npm workspaces (no Turborepo — unneeded complexity).
`@helpdesk/shared` contains wire contracts ONLY: DTO types, enums, Zod
schemas, Socket.IO event names/payloads. Zero server-only code.
**Consequences:** Frontend/backend can't drift on types; both sides validate
with the same schemas. Trade-off: workspace dep adds a build step to shared;
mitigated — Vite bundles it, api's `tsx`/build compiles it.

## ADR-004 — In-process domain event bus feeding Socket.IO

**Context:** Realtime needed but must not couple modules to socket plumbing.
**Decision:** Services emit domain events (`ticket:created`…) on an in-proc
emitter; `sockets/` subscribes and translates to room emissions.
**Consequences:** Phase 11 realtime is additive — zero service refactor.
Trade-off: single-instance only until Redis adapter (documented, post-MVP).

## ADR-005 — Argon2id for password hashing

**Context:** Spec: "Argon2id or well-supported alternative."
**Decision:** `argon2` package, id variant, OWASP-recommended params.
**Consequences:** Memory-hard resistance vs bcrypt's 72-byte limit; widely
supported in Node 20+.

## ADR-006 — Postgres sequence for `ticketNumber`

**Context:** Human-friendly ticket IDs (`HD-000123`) must be unique under
concurrency and never client-supplied.
**Decision:** DB sequence + service formats the display string; `unique`
constraint backstops it.
**Consequences:** Gap-tolerant, race-free, no retry loops.

## ADR-007 — SLA = calendar time, durable timestamps, scheduled checker

**Context:** Spec: state clearly whether SLA is calendar or business hours;
no in-memory-only timers.
**Decision:** `SlaTarget` (per-priority minutes) → snapshotted onto
`responseDueAt`/`resolutionDueAt` at create/priority-change; a periodic
server job (node-cron or setInterval worker) scans for breaches and emits
`ticket:sla_warning` + `Notification`. **Calendar time only** — no business
hours/holidays (explicitly documented as a limitation).
**Consequences:** Breach survives restarts; honest scope. Business-hours
SLA is a documented enhancement.

## ADR-008 — Local-disk uploads (dev) / S3-R2 (prod), authorized downloads

**Context:** Attachments must be private; Render disk is ephemeral.
**Decision:** `storageKey` abstraction — filesystem driver dev, S3
presigned prod; downloads only via authorized endpoint.
**Consequences:** No public URLs ever. Documented limitation: local-disk
files don't persist across Render deploys unless S3 configured.

## ADR-009 — Soft-delete tickets, append-only audit log

**Context:** Retention/deletion policy required; audit integrity matters.
**Decision:** `Ticket.deletedAt`; `AuditLog` has no update/delete paths.
Categories referenced by tickets are deactivated, not deleted.
**Consequences:** History survives; `WHERE deletedAt IS NULL` on list
queries (partial indexes). Retention: audit 24mo, sessions purged on expiry.

## ADR-010 — Prisma in `apps/api/prisma`, `migrate` for all changes

**Context:** Spec allows `prisma/` at root or in api.
**Decision:** `apps/api/prisma` — API self-contained for Render root-dir
deploys. All schema changes via `prisma migrate` versioned SQL; production
uses `migrate deploy` only (no `db push`, no `migrate reset`).
**Consequences:** Reproducible schema history; rollback = previous
migration + restore point (documented in deployment.md).

## ADR-011 — Pino structured logging with secret redaction

**Context:** Spec requires structured logs, no secrets in output.
**Decision:** `pino` + `pino-http`, `redact` paths for
`req.headers.cookie`, `body.password`, `body.token`; request-id per request.
**Consequences:** JSON logs prod / pretty dev; greppable request tracing.
