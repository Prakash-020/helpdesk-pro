# Monorepo-aware build — context is the repo root (shared is a source package).
#   docker build -f apps/api/Dockerfile -t helpdesk-api .

FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN cd apps/api && npx prisma generate && npm run build -w @helpdesk/api

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/packages packages
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY --from=build /app/apps/api/package.json apps/api/package.json
EXPOSE 4000
# migrate + start: one command so a fresh container self-provisions
CMD ["node", "apps/api/dist/server.js"]
