# Implementation Status

Live project state per the master prompt's protocol (§22.K). Updated at the
end of every substantial step. **Verified** = command actually executed and
output observed; **Expected** = not yet run.

## Current position

- **DEPLOYED** — live at https://helpdesk-pro-krzg.onrender.com (Render web service, Neon PG16, GitHub CI)
- **Next action:** optional roadmap polish — ⌘K palette, activity timeline, password reset
- **Last updated:** 2026-10-15

## Phases

| # | Phase | Status |
|---|---|---|
| 1 | Architecture & planning | ✅ complete |
| 2 | Repository & environment | ✅ complete (commit `4c6cbb7`) |
| 3 | Database foundation | ✅ complete — migration `20261015102652_init` applied, seed verified (6 users / 15 tickets / 14 comments / 20 notifications / 25 audit rows); all indexes confirmed via `\di` |
| 4 | Backend foundation | ✅ complete — helmet/CORS/cookies/pino/error-contract/env-validation/health |
| 5 | Auth & authorization | ✅ verified via curl — register/login/logout/me, bcrypt, hashed sessions, revocation, rate limit, origin check |
| 6 | Core ticket management | ✅ verified — scoped lists, state machine (incl. invalid-transition 409, reopen window), assignment, filters/pagination/search, audit writes |
| 7 | Conversations | ✅ verified — internal notes invisible to customers (query+serializer), customer reply auto-flips WAITING→IN_PROGRESS, firstResponseAt stamped |
| 8 | Frontend foundation | ✅ AppLayout, guards, RHF+Zod auth, typed api client, TanStack Query |
| 9 | Customer & agent workflows | ✅ tickets/queue/assigned/detail/new-ticket live |
| 10 | Administration | ✅ users/categories/audit/analytics pages + endpoints |
| 11 | Advanced features | ✅ realtime + attachments + SLA sweeper + SLA admin config done; password reset/S3 remain deferred (documented) |
| — | Demo polish | ✅ 62-ticket seed (172 comments, 94 notifications, 325 audit rows, 18 SLA-breached), one-click role demo logins, landing hero, SLA countdowns, demo badge |
| 12 | Quality assurance | ⬜ |
| 13 | Deployment | ⬜ |
| 14 | Portfolio delivery | ⬜ |

## Files created

- `docs/architecture.md` — full spec (topology, schema, indexes, contracts)
- `docs/decisions.md` — ADR-001…011
- `docs/implementation-status.md` — this file
- Root: `package.json` (workspaces), `tsconfig.base.json`, `eslint.config.js`,
  `.prettierrc.json`, `.gitignore`, `.nvmrc`, `.env.example`, `docker-compose.yml`
- `packages/shared/` — enums, DTOs, error codes, socket events, zod schemas
- `apps/api/` — express app, env validation, pino logger, error handler,
  `server.ts` graceful shutdown; `apps/api/.env` (generated secret, gitignored)
- `apps/web/` — Vite+React+Tailwind v4, router, query client, typed api client,
  Landing/Login/Register/NotFound pages

## Commands actually executed (verified)

| Command | Result |
|---|---|
| `node -v` | v26.8.1 ✅ (≥ v20 required) |
| `npm -v` | 11.19.0 ✅ (≥ v10 required) |
| `psql --version` | 16.15 (Homebrew) ✅ — usable as dev DB |
| `docker --version` | **not found** ⚠️ |
| `git --version` | 2.50.1 ✅ |
| `git init -b main` | repo initialized ✅ |
| `npm install` | 567 packages ✅ (postinstalls approved: esbuild, prisma) |
| `npm run dev:api` | running on :4000 ✅ |
| `npm run dev:web` | running on :5173 ✅ |
| `curl :4000/api/health` | `{"status":"ok"}` ✅ |
| `curl :5173/api/health` | proxied → `{"status":"ok"}` ✅ |
| `npm run typecheck` | clean across api/web/shared ✅ |
| `psql pg_ctl start` | postgres running on :5432 ✅ (stale postmaster.pid removed) |
| `prisma migrate dev` | `20261015102652_init` applied ✅ |
| `tsx prisma/seed.ts` | 6 users / 15 tickets / 14 comments / 20 notif / 25 audit ✅ |
| curl auth matrix | register 201, me 200, no-cookie 401, bad login 401, dup 409, logout revokes ✅ |
| curl ticket matrix | create 201, own-list 6, cross-customer 404, queue 6, assign→IN_PROGRESS, invalid transition 409, internal note hidden from customer, customer-reply flip, reopen+close, audit trail 10 rows, agent/admin 403s ✅ |
| `curl /analytics/overview` | real aggregates (total 16, avg times) ✅ |
| `npx vitest run` (api) | 17/17 ✅ — auth matrix, scoping, transitions, internal-note secrecy |
| `npx vitest run` (web) | 10/10 ✅ — badges, dialog, pagination, time utils |
| `npx playwright test` | 5/5 ✅ — demo login, customer reply, agent queue, admin pages, route guard |
| attachments curl | upload/list/download/delete + 404 authz matrix ✅ |
| comment ops curl | edit own ✅, stranger 404 ✅, delete ✅ |
| sla-targets | GET/PATCH ✅, customer 403 ✅; sweep sent warnings at boot ✅ |
| `npm run lint --workspaces` | clean ✅ |
| `npm run build --workspaces` | api + web production builds ✅ |
| `/api/docs` | Swagger UI live ✅ |

## Environment notes

- Docker Desktop absent → dev DB will use local Homebrew PostgreSQL 16;
  `docker-compose.yml` still ships (db on host port 5433 to avoid clash).
- ADR-005 amended: `bcryptjs` chosen over `argon2` — pure-JS, no native
  build risk; cost factor 12. Argon2id remains a documented upgrade path.

## Tests run

None yet — test harness lands with the auth phase (Phase 5).

## Known bugs / blockers

None.

## Remaining tasks

Phases 3–14 per `docs/architecture.md` §8 roadmap.
Live preview: http://localhost:5173 (dev servers currently running).
