# Implementation Status

Live project state per the master prompt's protocol (§22.K). Updated at the
end of every substantial step. **Verified** = command actually executed and
output observed; **Expected** = not yet run.

## Current position

- **Phase:** 2 — Repository & environment → **COMPLETE**
- **Next action:** Phase 3 — Prisma schema + first migration + seed
- **Last updated:** 2026-10-15

## Phases

| # | Phase | Status |
|---|---|---|
| 1 | Architecture & planning | ✅ complete |
| 2 | Repository & environment | ✅ complete (commit `4c6cbb7`) |
| 3 | Database foundation | ⬜ |
| 4 | Backend foundation | ⬜ |
| 5 | Auth & authorization | ⬜ |
| 6 | Core ticket management | ⬜ |
| 7 | Conversations | ⬜ |
| 8 | Frontend foundation | ⬜ |
| 9 | Customer & agent workflows | ⬜ |
| 10 | Administration | ⬜ |
| 11 | Advanced features | ⬜ |
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
