#!/usr/bin/env bash
set -euo pipefail
if [[ -z "${DATABASE_URL:-}" ]]; then echo "Error: DATABASE_URL is not set" >&2; exit 1; fi
echo "Running migration 013: allow multi-journal participation..."
psql "$DATABASE_URL" -f "$(dirname "$0")/013_global_people.sql"
echo "Migration 013 complete."
