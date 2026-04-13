# ── Build stage ──
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy workspace manifests
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json ./
COPY packages/ ./packages/
COPY services/sales-service/package.json ./services/sales-service/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY services/sales-service/ ./services/sales-service/

# Build
RUN pnpm --filter sales-service build

# ── Production stage ──
FROM node:20-alpine AS production

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/ ./packages/
COPY services/sales-service/package.json ./services/sales-service/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/services/sales-service/dist ./services/sales-service/dist

WORKDIR /app/services/sales-service

ENV NODE_ENV=production
EXPOSE 3003

CMD ["node", "dist/main.js"]
