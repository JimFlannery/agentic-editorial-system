#!/usr/bin/env bash
set -euo pipefail
if [[ -z "${DATABASE_URL:-}" ]]; then echo "Error: DATABASE_URL is not set" >&2; exit 1; fi
echo "Running migration 008: manuscript file columns..."
psql "$DATABASE_URL" -f "$(dirname "$0")/008_manuscript_file.sql"
echo "Migration 008 complete."
