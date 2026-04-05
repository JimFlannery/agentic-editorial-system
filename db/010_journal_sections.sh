#!/usr/bin/env bash
set -euo pipefail
if [[ -z "${DATABASE_URL:-}" ]]; then echo "Error: DATABASE_URL is not set" >&2; exit 1; fi
echo "Running migration 010: journal sections..."
psql "$DATABASE_URL" -f "$(dirname "$0")/010_journal_sections.sql"
echo "Migration 010 complete."
