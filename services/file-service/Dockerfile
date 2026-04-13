# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

COPY packages/shared-types/package.json packages/shared-types/
COPY packages/shared-utils/package.json packages/shared-utils/
COPY packages/database/package.json packages/database/
COPY services/file-service/package.json services/file-service/

RUN pnpm install --frozen-lockfile

COPY packages/ packages/
COPY services/file-service/ services/file-service/

RUN pnpm --filter @caisseflow/shared-types build 2>/dev/null || true
RUN pnpm --filter @caisseflow/shared-utils build 2>/dev/null || true
RUN pnpm --filter @caisseflow/file-service build

# ---- Production Stage ----
FROM node:20-alpine AS production

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/shared-utils/package.json packages/shared-utils/
COPY packages/database/package.json packages/database/
COPY services/file-service/package.json services/file-service/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/services/file-service/dist services/file-service/dist

USER appuser

EXPOSE 3006

ENV NODE_ENV=production

CMD ["node", "services/file-service/dist/main.js"]
