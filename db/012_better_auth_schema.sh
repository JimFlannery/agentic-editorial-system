#!/usr/bin/env bash
set -euo pipefail
if [[ -z "${DATABASE_URL:-}" ]]; then echo "Error: DATABASE_URL is not set" >&2; exit 1; fi
echo "Running migration 012: Better Auth schema..."
psql "$DATABASE_URL" -f "$(dirname "$0")/012_better_auth_schema.sql"
echo "Migration 012 complete."
