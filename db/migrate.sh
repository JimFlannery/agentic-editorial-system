#!/usr/bin/env bash
# Run all pending database migrations.
# Works both locally (reads .env.local) and inside the Docker container (reads
# DATABASE_URL from the environment). Safe to run multiple times — already-applied
# migrations are skipped.
#
# Usage:
#   bash db/migrate.sh          # local dev (reads .env.local)
#   DATABASE_URL=... bash db/migrate.sh  # explicit override

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load .env.local if present (local dev convenience)
if [ -f "$SCRIPT_DIR/../.env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  source <(grep -v '^#' "$SCRIPT_DIR/../.env.local" | grep -v '^$')
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Error: DATABASE_URL is not set." >&2
  echo "  For local dev: set it in .env.local" >&2
  echo "  For Docker: pass it as an environment variable" >&2
  exit 1
fi

psql_run() {
  psql "$DATABASE_URL" "$@"
}

echo "=== Agentic Editorial System — database migrations ==="
echo ""

# 1. Run init.sql (idempotent — CREATE TABLE IF NOT EXISTS throughout)
echo "Applying init.sql..."
psql_run -f "$SCRIPT_DIR/init.sql" -q
echo "  ✓ init.sql applied"

# 2. Ensure migration tracking table exists
#    Column is 'version' (basename without .sql) for backwards compatibility.
psql_run -q -c "
  CREATE TABLE IF NOT EXISTS manuscript.schema_migrations (
    version    TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
"

# 3. Apply numbered migration SQL files in order
for sql_file in "$SCRIPT_DIR"/[0-9][0-9][0-9]_*.sql; do
  [ -f "$sql_file" ] || continue
  version="$(basename "$sql_file" .sql)"

  applied=$(psql_run -tAc \
    "SELECT 1 FROM manuscript.schema_migrations WHERE version = '$version'" \
    2>/dev/null || echo "")

  if [ "$applied" = "1" ]; then
    echo "  – $version (already applied, skipping)"
  else
    echo "  Applying $version..."
    psql_run -q -f "$sql_file"
    psql_run -q -c \
      "INSERT INTO manuscript.schema_migrations (version) VALUES ('$version') ON CONFLICT DO NOTHING"
    echo "  ✓ $version applied"
  fi
done

echo ""
echo "=== Migrations complete ==="
