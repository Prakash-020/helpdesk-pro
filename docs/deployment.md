# Deployment guide

Reference topology: **web on Vercel, API on Render, Postgres on Neon** — all
free tiers work for a portfolio demo. Swap providers freely; the env contract
below is the only provider-specific surface.

## 1. Database (Neon, or any managed Postgres 16)

1. Create a project → copy the `DATABASE_URL` (`postgres://…?sslmode=require`).
2. Apply schema + seed:

```bash
cd apps/api
DATABASE_URL=<prod-url> npx prisma migrate deploy
DATABASE_URL=<prod-url> npm run db:seed    # demo dataset — optional
```

## 2. API (Render / Railway / Fly)

- **Build:** `npm ci && npm run build -w @helpdesk/api`
- **Start:** `node apps/api/dist/server.js` (or `npm start -w @helpdesk/api`)
- **Health check:** `GET /api/health` → `{ "status": "ok" }`
- **Docs:** `GET /api/docs` (Swagger UI)

### Required env vars (API)

| Var | Example | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Enables `Secure` session cookie |
| `PORT` | `4000` | Usually injected by the platform |
| `DATABASE_URL` | `postgres://…?sslmode=require` | |
| `SESSION_SECRET` | `openssl rand -hex 32` | ≥32 chars |
| `WEB_ORIGIN` | `https://your-app.vercel.app` | CORS + socket origin allowlist |
| `UPLOAD_DIR` | `/data/uploads` | Needs a persistent disk/volume on the host |
| `SLA_SWEEP_MINUTES` | `15` | Sweep cadence |

## 3. Web (Vercel)

- **Root:** `apps/web` · **Build:** `npm run build` · **Output:** `dist`
- SPA needs an API base. In dev, Vite proxies `/api`; in prod point requests at
  the API host — either set `VITE_API_URL=https://api.example.com` (the fetch
  client prefixes it) **or** add a Vercel rewrite:

```json
// apps/web/vercel.json
{ "rewrites": [{ "source": "/api/(.*)", "destination": "https://api.example.com/api/$1" },
               { "source": "/socket.io/(.*)", "destination": "https://api.example.com/socket.io/$1" }] }
```

> Note: Socket.IO through serverless rewrites falls back to long-polling —
> acceptable for the demo; for true websockets, point the client directly at the
> API origin (`VITE_SOCKET_URL`) or use a host that proxies WS (Render, Fly, Railway).

## 4. Production checklist

- [ ] `NODE_ENV=production` on API (secure cookies)
- [ ] `SESSION_SECRET` is a real random 32+ char secret — never committed
- [ ] `WEB_ORIGIN` = exact frontend origin (no trailing slash)
- [ ] `prisma migrate deploy` ran against the prod DB
- [ ] Uploads dir is a persistent volume (ephemeral FS loses files on redeploy —
      move to S3 for real storage; see decisions.md ADR)
- [ ] `GET /api/health` returns 200 externally
- [ ] Demo login works; socket connects (check browser devtools Network → `socket.io`)

## Docker alternative

`docker-compose.yml` ships Postgres for dev. A production API image is
`apps/api/Dockerfile` — build + run:

```bash
docker build -f apps/api/Dockerfile -t helpdesk-api .
docker run -p 4000:4000 --env-file apps/api/.env helpdesk-api
```
