#!/usr/bin/env bash
# docker-entrypoint.sh — runs at container start before the app server
# Applies all pending database migrations (app schema + Better Auth tables),
# then hands off to CMD (node server.js).
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL environment variable is not set." >&2
  echo "Set it in your docker-compose.yml or container environment." >&2
  exit 1
fi

echo "=== Running database migrations ==="
bash /app/db/migrate.sh

echo "=== Migrations complete — starting application ==="
exec "$@"
