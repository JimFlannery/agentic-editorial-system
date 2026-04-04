#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Error: DATABASE_URL is not set" >&2
  exit 1
fi

echo "Running migration 007: form_fields table..."
psql "$DATABASE_URL" -f "$(dirname "$0")/007_form_fields.sql"
echo "Migration 007 complete."
