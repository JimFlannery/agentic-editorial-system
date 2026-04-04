#!/usr/bin/env bash
set -euo pipefail
if [[ -z "${DATABASE_URL:-}" ]]; then echo "Error: DATABASE_URL is not set" >&2; exit 1; fi
echo "Running migration 009: reviewer assignment tracking..."
psql "$DATABASE_URL" -f "$(dirname "$0")/009_reviewer_assignments.sql"
echo "Migration 009 complete."
