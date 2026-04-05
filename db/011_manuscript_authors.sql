-- =============================================================================
-- Migration 011 — manuscript author list
-- =============================================================================
-- Tracks all authors on a manuscript in display order.
-- The corresponding author is flagged with is_corresponding = true.
-- manuscripts.submitted_by remains the FK for the submitting person;
-- this table is the canonical ordered author list for display and attribution.

CREATE TABLE IF NOT EXISTS manuscript.manuscript_authors (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id    UUID NOT NULL REFERENCES manuscript.manuscripts(id) ON DELETE CASCADE,
  person_id        UUID NOT NULL REFERENCES manuscript.people(id),
  is_corresponding BOOLEAN NOT NULL DEFAULT false,
  display_order    INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (manuscript_id, person_id)
);

CREATE INDEX IF NOT EXISTS manuscript_authors_manuscript_idx
  ON manuscript.manuscript_authors (manuscript_id);

-- Backfill: promote the existing submitted_by person as corresponding author
-- for all manuscripts that don't yet have an author list entry.
INSERT INTO manuscript.manuscript_authors
  (manuscript_id, person_id, is_corresponding, display_order)
SELECT
  m.id,
  m.submitted_by,
  true,
  0
FROM manuscript.manuscripts m
WHERE m.submitted_by IS NOT NULL
ON CONFLICT (manuscript_id, person_id) DO NOTHING;
