-- =============================================================================
-- Migration 010 — journal sections
-- =============================================================================
-- Sections allow journals to divide editorial work by subject area.
-- An AE or editor can be scoped to a section; they will only see manuscripts
-- whose subject_area matches that section's subject_tags.
-- section_id = NULL on a person_role means "no restriction — sees all".

CREATE TABLE manuscript.journal_sections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id    UUID NOT NULL REFERENCES manuscript.journals(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  subject_tags  TEXT[] NOT NULL DEFAULT '{}',
  active        BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (journal_id, name)
);

-- Add optional section scope to person_roles.
-- The existing unique constraint (person_id, journal_id, role) is preserved —
-- a person holds at most one section scope per role per journal.
ALTER TABLE manuscript.person_roles
  ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES manuscript.journal_sections(id) ON DELETE SET NULL;
