#!/usr/bin/env bash
set -euo pipefail
if [[ -z "${DATABASE_URL:-}" ]]; then echo "Error: DATABASE_URL is not set" >&2; exit 1; fi
echo "Running migration 010: manuscript tracking numbers..."
psql "$DATABASE_URL" -f "$(dirname "$0")/010_tracking_number.sql"
echo "Migration 010 complete."
