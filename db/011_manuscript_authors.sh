#!/usr/bin/env bash
set -euo pipefail
if [[ -z "${DATABASE_URL:-}" ]]; then echo "Error: DATABASE_URL is not set" >&2; exit 1; fi
echo "Running migration 011: manuscript author list..."
psql "$DATABASE_URL" -f "$(dirname "$0")/011_manuscript_authors.sql"
echo "Migration 011 complete."
