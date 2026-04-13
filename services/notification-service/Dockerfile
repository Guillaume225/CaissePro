# ------------------------------------------------------------------
# Stage 1: Install dependencies
# ------------------------------------------------------------------
FROM node:18-alpine AS deps
RUN corepack enable && corepack prepare pnpm@8 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --prod=false

# ------------------------------------------------------------------
# Stage 2: Build
# ------------------------------------------------------------------
FROM node:18-alpine AS build
RUN corepack enable && corepack prepare pnpm@8 --activate
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm build

# ------------------------------------------------------------------
# Stage 3: Production
# ------------------------------------------------------------------
FROM node:18-alpine AS production
RUN corepack enable && corepack prepare pnpm@8 --activate
WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./

EXPOSE 3005

CMD ["node", "dist/main.js"]
