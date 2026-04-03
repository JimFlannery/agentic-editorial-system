-- =============================================================================
-- Migration 004 — CRediT Contributor Role Taxonomy + journal_settings
-- https://credit.niso.org/
-- =============================================================================
-- Run via: bash db/004_credit.sh
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. manuscript.journal_settings
--    Key-value store for scalar journal configuration.
--    Known key: credit_taxonomy_enabled ('true' | 'false', default false)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS manuscript.journal_settings (
    journal_id   UUID NOT NULL REFERENCES manuscript.journals(id) ON DELETE CASCADE,
    key          TEXT NOT NULL,
    value        TEXT NOT NULL,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (journal_id, key)
);

-- ---------------------------------------------------------------------------
-- 2. manuscript.credit_contributions
--    One row per (manuscript, person, CRediT role).
--    credit_role stores one of the 14 CRediT slugs defined in lib/credit.ts.
--    degree is optional: lead | equal | supporting.
-- ---------------------------------------------------------------------------
CREATE TYPE IF NOT EXISTS manuscript.credit_degree AS ENUM (
    'lead',
    'equal',
    'supporting'
);

CREATE TABLE IF NOT EXISTS manuscript.credit_contributions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manuscript_id UUID NOT NULL REFERENCES manuscript.manuscripts(id) ON DELETE CASCADE,
    person_id     UUID NOT NULL REFERENCES manuscript.people(id),
    credit_role   TEXT NOT NULL,
    degree        manuscript.credit_degree,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (manuscript_id, person_id, credit_role)
);

CREATE INDEX IF NOT EXISTS credit_contributions_manuscript_idx
    ON manuscript.credit_contributions (manuscript_id);
