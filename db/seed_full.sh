#!/usr/bin/env bash
# Reset the database to a known test state.
#
# Applies any missing migrations (skips ones already applied), then seeds
# with full test data. Safe to re-run at any time.
#
# Usage: bash db/seed_full.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE="docker compose -f $SCRIPT_DIR/../docker-compose.yml"

if [ -f "$SCRIPT_DIR/../.env.local" ]; then
  export $(grep -v '^#' "$SCRIPT_DIR/../.env.local" | grep -v '^$' | xargs)
fi

POSTGRES_USER="${POSTGRES_USER:-ems}"
POSTGRES_DB="${POSTGRES_DB:-ems_db}"

psql_run() {
  $COMPOSE exec -T postgres-age psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f - < "$1"
}

psql_query() {
  $COMPOSE exec -T postgres-age psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "$1"
}

# --- Step 1: init.sql (skipped if schema already exists) ---
SCHEMA_EXISTS=$(psql_query \
  "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='manuscript' AND table_name='journals')")

if [ "$SCHEMA_EXISTS" = "f" ]; then
  echo "=== Step 1/3: init.sql (schema + AGE extension) ==="
  psql_run "$SCRIPT_DIR/init.sql"
else
  echo "=== Step 1/3: init.sql (skipped — schema already exists) ==="
fi

# --- Step 2: 002_manuscript_types.sql (skipped if table already exists) ---
TYPES_EXISTS=$(psql_query \
  "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='manuscript' AND table_name='manuscript_types')")

if [ "$TYPES_EXISTS" = "f" ]; then
  echo "=== Step 2/3: 002_manuscript_types.sql ==="
  psql_run "$SCRIPT_DIR/002_manuscript_types.sql"
else
  echo "=== Step 2/3: 002_manuscript_types.sql (skipped — table already exists) ==="
fi

# --- Step 3: seed ---
echo "=== Step 3/3: seed_full.sql ==="
echo "  Journals: 2  |  People: 15  |  Manuscript types: 7  |  Manuscripts: 3"
psql_run "$SCRIPT_DIR/seed_full.sql"

echo "Done."
