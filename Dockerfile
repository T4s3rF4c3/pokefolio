# syntax=docker/dockerfile:1.7

# ---------- deps ----------
# Install production+dev deps on a fixed Node 20 base. We pin to slim (Debian)
# rather than alpine to dodge Prisma's OpenSSL/musl edge cases on Unraid.
FROM node:20-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
COPY prisma ./prisma
# package.json's `postinstall` runs `prisma generate`, which needs the schema
# we just copied — so `npm ci` produces a ready-to-use client by itself.
RUN npm ci --no-audit --no-fund

# ---------- build ----------
FROM node:20-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Prisma's generated client lives in node_modules/.prisma — keep it.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------- runner ----------
FROM node:20-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        openssl ca-certificates tini gosu \
    && rm -rf /var/lib/apt/lists/* \
    && (userdel -r node 2>/dev/null || true) \
    && (groupdel node 2>/dev/null || true) \
    && groupadd -g 1000 nodeapp \
    && useradd -m -u 1000 -g 1000 -s /bin/bash nodeapp

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_URL=file:/app/data/pokefolio.db \
    PUID=1000 \
    PGID=1000 \
    TZ=Europe/Berlin

# Standalone server + static + public.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Prisma runtime: generated client, query engines, and the CLI so the
# entrypoint can run `prisma db push` for first-boot schema creation.
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Persistent dirs created here so the chown in the entrypoint has something
# to work with even before the user binds a volume.
RUN mkdir -p /app/data /app/public/uploads

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3000
VOLUME ["/app/data", "/app/public/uploads"]

# tini reaps zombies; entrypoint handles PUID/PGID + first-run schema.
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]
