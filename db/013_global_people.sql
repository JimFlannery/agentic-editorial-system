-- =============================================================================
-- Migration 013 — Allow one auth user to participate in multiple journals
-- =============================================================================
-- Drops the UNIQUE constraint on manuscript.people.auth_user_id so that a
-- single Better Auth user can be linked to multiple manuscript.people rows
-- (one per journal they participate in). Each people row remains journal-
-- scoped via its journal_id column; person_roles still attaches roles per
-- (person_id, journal_id, role).
--
-- Existing application code uses `WHERE auth_user_id = $1 AND journal_id = $2`
-- to look up the per-journal identity, which continues to work unchanged.
--
-- Why drop only the constraint instead of restructuring `people` to be a
-- single global identity row: the smaller change unblocks multi-journal
-- participation with zero impact on the ~16 call sites that currently rely
-- on per-journal people lookups. A larger refactor (drop journal_id from
-- people; make person_roles the sole source of journal scoping) is possible
-- later if the redundant scoping causes pain in practice.
-- =============================================================================

ALTER TABLE manuscript.people DROP CONSTRAINT IF EXISTS people_auth_user_id_key;

-- Replace the implicit unique index with a non-unique btree index so lookups
-- by auth_user_id remain fast.
CREATE INDEX IF NOT EXISTS people_auth_user_id_idx
    ON manuscript.people (auth_user_id);
