# Barebook — single container, single volume.
# Build: docker build -t barebook .
# Run:   see docker-compose.yml

# ---- deps: install with the toolchain ready in case better-sqlite3 has no
# prebuilt binary for the platform (musl on alpine) -------------------------
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: compile the standalone Next.js output ------------------------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runner: minimal image, non-root, data on a volume --------------------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV DATA_DIR=/data
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# migrations run on boot from this folder; fonts are loaded at PDF time
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/src/assets/fonts ./src/assets/fonts

RUN mkdir -p /data && chown -R node:node /app /data
USER node
VOLUME /data
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
