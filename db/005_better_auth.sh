#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Error: DATABASE_URL is not set" >&2
  exit 1
fi

echo "Running migration 005: Better Auth tables + auth_user_id..."
psql "$DATABASE_URL" -f "$(dirname "$0")/005_better_auth.sql"
echo "Migration 005 complete."
