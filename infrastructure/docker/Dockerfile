# syntax=docker/dockerfile:1.7
# Imagen única: API + SPA estática + trabajador (deployment-design §1, ADR-020).
# Build:  docker build -f infrastructure/docker/Dockerfile -t quatreros:local .

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

# 1) Dependencias (capa cacheable)
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
COPY packages/config/package.json packages/config/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# 2) Compilación
FROM deps AS build
COPY . .
RUN pnpm build \
 && pnpm --filter @quatreros/api deploy --prod --legacy /out/api

# 3) Ejecución: solo lo necesario, usuario sin privilegios
FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=build /out/api ./apps/api
COPY --from=build /repo/apps/web/dist ./apps/web/dist
RUN addgroup -S quatreros && adduser -S quatreros -G quatreros
USER quatreros
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/health || exit 1
WORKDIR /app/apps/api
CMD ["node", "dist/main.js"]
