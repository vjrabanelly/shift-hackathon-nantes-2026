FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN npm ci

# Build shared + api
FROM deps AS builder
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN npm run build --workspace=apps/api

# Production image
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules 2>/dev/null || true
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/packages/shared ./packages/shared

RUN mkdir -p uploads

EXPOSE 3001
CMD ["node", "dist/main.js"]
