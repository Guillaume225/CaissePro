# ─── Build stage ───
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy workspace root
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./

# Copy only required packages
COPY packages/database ./packages/database
COPY packages/shared-types ./packages/shared-types
COPY packages/shared-utils ./packages/shared-utils
COPY services/demande-achat-service ./services/demande-achat-service

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Build shared packages then the service
RUN pnpm --filter @caisseflow/database build 2>/dev/null || true
RUN pnpm --filter @caisseflow/shared-types build 2>/dev/null || true
RUN pnpm --filter @caisseflow/shared-utils build 2>/dev/null || true
RUN pnpm --filter @caisseflow/demande-achat-service build

# ─── Production stage ───
FROM node:20-alpine AS production

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

ENV NODE_ENV=production

# Copy workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copy built packages
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/demande-achat-service ./services/demande-achat-service

# Install prod deps only
RUN pnpm install --frozen-lockfile --prod

# Create uploads directory
RUN mkdir -p /app/services/demande-achat-service/uploads

# Run as non-root
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup && \
    chown -R appuser:appgroup /app
USER appuser

WORKDIR /app/services/demande-achat-service

EXPOSE 3007

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3007/api/v1/health || exit 1

CMD ["node", "dist/main.js"]
