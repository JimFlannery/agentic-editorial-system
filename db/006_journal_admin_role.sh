#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Error: DATABASE_URL is not set" >&2
  exit 1
fi

echo "Running migration 006: journal_admin role..."
psql "$DATABASE_URL" -f "$(dirname "$0")/006_journal_admin_role.sql"
echo "Migration 006 complete."
