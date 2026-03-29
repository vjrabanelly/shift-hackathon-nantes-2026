FROM node:20-slim

# Install system dependencies
# ffmpeg: audio transcoding and HLS generation
# python3 + yt-dlp: YouTube audio download
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace files needed for pnpm to resolve workspace:* dependencies
# IMPORTANT: must copy from workspace root — not just apps/api/
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./tsconfig.base.json
COPY settings.py ./settings.py
COPY services/ ./services/
COPY packages/ packages/
COPY apps/api/ apps/api/
COPY apps/web/ apps/web/

RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

RUN pip install --no-cache-dir yt-dlp \
    && pip install --no-cache-dir -r services/requirements.txt

# Install all workspace dependencies (includes @partyjam/shared etc.)
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @partyjam/shared build
RUN pnpm --filter @partyjam/connectors build

# Build the web app (Vite SPA) — env vars baked in at build time
ARG VITE_API_URL=
ARG VITE_SUPABASE_URL=
ARG VITE_SUPABASE_ANON_KEY=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
RUN pnpm --filter @partyjam/web build

# Build the API (TypeScript → JavaScript)
RUN pnpm --filter @partyjam/api build

# Copy web build into the API's public directory so Fastify can serve it
RUN mkdir -p apps/api/public/web && cp -r apps/web/dist/. apps/api/public/web/

WORKDIR /app/apps/api

# Create temp directories for audio and HLS files
RUN mkdir -p /tmp/partyjam/audio /tmp/partyjam/hls /tmp/partyjam/transitions

EXPOSE 3000

CMD ["node", "dist/apps/api/src/index.js"]
