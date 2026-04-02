#!/usr/bin/env bash
# Run the seed script against the running postgres-age container.
# Usage: bash db/seed.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$SCRIPT_DIR/../.env.local" ]; then
  export $(grep -v '^#' "$SCRIPT_DIR/../.env.local" | grep -v '^$' | xargs)
fi

POSTGRES_USER="${POSTGRES_USER:-ems}"
POSTGRES_DB="${POSTGRES_DB:-ems_db}"

echo "Seeding $POSTGRES_DB as $POSTGRES_USER..."

docker compose -f "$SCRIPT_DIR/../docker-compose.yml" exec -T postgres-age \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f - < "$SCRIPT_DIR/seed.sql"

echo "Done."
