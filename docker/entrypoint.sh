#!/bin/sh
# Pokéfolio container entrypoint.
#
# Responsibilities:
#   1. Honor Unraid-style PUID/PGID by remapping the `nodeapp` user.
#   2. Make sure the data + uploads dirs exist and are writable.
#   3. Apply the Prisma schema to the SQLite file (idempotent, never
#      drops data; new columns get added, missing tables get created).
#   4. Hand off to the actual server with the right user.
set -e

PUID="${PUID:-1000}"
PGID="${PGID:-1000}"

CURRENT_UID="$(id -u nodeapp)"
CURRENT_GID="$(id -g nodeapp)"
if [ "$CURRENT_UID" != "$PUID" ] || [ "$CURRENT_GID" != "$PGID" ]; then
  echo "[pokefolio] remapping nodeapp -> ${PUID}:${PGID}"
  groupmod -o -g "$PGID" nodeapp >/dev/null 2>&1 || true
  usermod  -o -u "$PUID" -g "$PGID" nodeapp >/dev/null 2>&1 || true
fi

# /app/.next/cache: Next's standalone server writes its incremental/prerender
# cache here at runtime. The .next tree is COPYed in as root, so without this the
# remapped runtime user hits "EACCES: mkdir '/app/.next/cache'" the first time a
# cached route (e.g. a card detail page) is rendered.
mkdir -p /app/data /app/public/uploads /app/.next/cache
chown -R "${PUID}:${PGID}" /app/data /app/public/uploads /app/.next/cache /app/node_modules/.prisma /app/prisma 2>/dev/null || true

# Apply schema. Safe on a fresh DB (creates everything) and safe across
# restarts (no-op when already current). Additive schema changes apply
# transparently — destructive ones intentionally fail rather than wipe data.
echo "[pokefolio] applying Prisma schema to ${DATABASE_URL}"
gosu "${PUID}:${PGID}" node node_modules/prisma/build/index.js db push --skip-generate || {
  echo "[pokefolio] prisma db push failed — refusing to start." >&2
  exit 1
}

echo "[pokefolio] starting server on :${PORT:-3000} as ${PUID}:${PGID}"
exec gosu "${PUID}:${PGID}" "$@"
