#!/usr/bin/env bash
# Run migration 004 — CRediT Contributor Role Taxonomy + journal_settings
# Usage: bash db/004_credit.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$SCRIPT_DIR/../.env.local" ]; then
  export $(grep -v '^#' "$SCRIPT_DIR/../.env.local" | grep -v '^$' | xargs)
fi

POSTGRES_USER="${POSTGRES_USER:-ems}"
POSTGRES_DB="${POSTGRES_DB:-ems_db}"

echo "Running 004_credit.sql against $POSTGRES_DB..."

docker compose -f "$SCRIPT_DIR/../docker-compose.yml" exec -T postgres-age \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f - < "$SCRIPT_DIR/004_credit.sql"

echo "Done."
