# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace root files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copy shared packages
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/shared-utils/package.json packages/shared-utils/
COPY packages/database/package.json packages/database/

# Copy auth-service
COPY services/auth-service/package.json services/auth-service/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/ packages/
COPY services/auth-service/ services/auth-service/

# Build shared packages first, then auth-service
RUN pnpm --filter @caisseflow/shared-types build 2>/dev/null || true
RUN pnpm --filter @caisseflow/shared-utils build 2>/dev/null || true
RUN pnpm --filter @caisseflow/auth-service build

# ---- Production Stage ----
FROM node:20-alpine AS production

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Add non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/shared-utils/package.json packages/shared-utils/
COPY packages/database/package.json packages/database/
COPY services/auth-service/package.json services/auth-service/

RUN pnpm install --frozen-lockfile --prod

# Copy built output
COPY --from=builder /app/services/auth-service/dist services/auth-service/dist

USER appuser

EXPOSE 3001

ENV NODE_ENV=production

CMD ["node", "services/auth-service/dist/main.js"]
