#!/usr/bin/env bash
# Load the TEST journal seed data.
#
# Seeds the "Journal for Testing AgenticES" (acronym: TEST) with a complete set
# of editors, reviewers, authors, and manuscripts covering all workflow states.
# Safe to re-run — the seed SQL deletes and re-inserts all TEST journal data.
#
# Runs all pending migrations first so the schema is always up to date.
#
# Usage:
#   bash db/seed_test.sh          # local dev (reads .env.local)
#   DATABASE_URL=... bash db/seed_test.sh  # explicit override

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load .env.local if present (local dev convenience)
if [ -f "$SCRIPT_DIR/../.env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  source <(grep -v '^#' "$SCRIPT_DIR/../.env.local" | grep -v '^$')
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Error: DATABASE_URL is not set." >&2
  echo "  For local dev: set it in .env.local" >&2
  echo "  For Docker: pass it as an environment variable" >&2
  exit 1
fi

psql_run() {
  psql "$DATABASE_URL" "$@"
}

echo "=== Agentic Editorial System — TEST journal seed ==="
echo ""

# Step 1: Run all pending migrations
echo "Step 1/2: Running migrations..."
bash "$SCRIPT_DIR/migrate.sh"
echo ""

# Step 2: Load the test seed
echo "Step 2/2: Loading TEST journal seed data..."
echo "  Journal:  Journal for Testing AgenticES (TEST)"
echo "  Users:    10  (eic, editor, ae, support, 3 reviewers, 3 authors)"
echo "  Manuscripts: 8  (submitted×3, under_review×2, revision_requested, accepted, rejected)"
psql_run -q -f "$SCRIPT_DIR/seed_test.sql"
echo "  ✓ seed_test.sql applied"

echo ""
echo "=== TEST journal seed complete ==="
echo ""
echo "Login credentials (all users): password"
echo ""
echo "  eic@test.example.com       — Editor-in-Chief"
echo "  editor@test.example.com    — Editor"
echo "  ae@test.example.com        — Assistant Editor"
echo "  support@test.example.com   — Editorial Support"
echo "  reviewer1@test.example.com — Reviewer"
echo "  reviewer2@test.example.com — Reviewer"
echo "  reviewer3@test.example.com — Reviewer"
echo "  author1@test.example.com   — Author"
echo "  author2@test.example.com   — Author"
echo "  author3@test.example.com   — Author"
