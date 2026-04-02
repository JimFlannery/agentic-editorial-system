-- =============================================================================
-- Migration 003 — Add acronym to journals
-- =============================================================================
-- Run via: bash db/003_journal_acronym.sh
-- NOTE: Existing journals must be given an acronym before the NOT NULL
--       constraint is applied. Set them first, then run this migration.
-- =============================================================================

ALTER TABLE manuscript.journals ADD COLUMN IF NOT EXISTS acronym TEXT;

-- Populate any nulls before enforcing constraints (edit as needed for your data)
-- UPDATE manuscript.journals SET acronym = 'J' || id::text WHERE acronym IS NULL;

ALTER TABLE manuscript.journals ADD CONSTRAINT journals_acronym_unique UNIQUE (acronym);
ALTER TABLE manuscript.journals ALTER COLUMN acronym SET NOT NULL;
