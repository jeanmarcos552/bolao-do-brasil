# syntax=docker/dockerfile:1
# Build multi-stage do Next.js em modo standalone (next.config.mjs: output:'standalone').
# Node 22 slim (Debian): firebase-admin@14 exige engine node>=22; slim evita
# surpresas de libs nativas no musl do Alpine.

# 1) Dependencias (cacheavel enquanto o lockfile nao muda)
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 2) Build. As NEXT_PUBLIC_* sao inlinadas no bundle do cliente em build-time,
#    entao precisam existir aqui (passadas como --build-arg no docker build).
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID \
    NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# 3) Runtime enxuto. Segredos de servidor (FIREBASE_ADMIN_*, WS_API_KEY, etc.)
#    entram em runtime via --env-file, nunca embutidos na imagem.
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3002 \
    HOSTNAME=0.0.0.0

# usuario nao-root
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3002
CMD ["node", "server.js"]
