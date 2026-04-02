#!/usr/bin/env bash
# Run migration 002 — manuscript types table
# Usage: bash db/002_manuscript_types.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$SCRIPT_DIR/../.env.local" ]; then
  export $(grep -v '^#' "$SCRIPT_DIR/../.env.local" | grep -v '^$' | xargs)
fi

POSTGRES_USER="${POSTGRES_USER:-ems}"
POSTGRES_DB="${POSTGRES_DB:-ems_db}"

echo "Running 002_manuscript_types.sql against $POSTGRES_DB..."

docker compose -f "$SCRIPT_DIR/../docker-compose.yml" exec -T postgres-age \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f - < "$SCRIPT_DIR/002_manuscript_types.sql"

echo "Done."
