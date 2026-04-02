-- =============================================================================
-- Migration 002 — Manuscript Types
-- =============================================================================
-- Run via: bash db/002_manuscript_types.sh
-- =============================================================================

CREATE TABLE manuscript.manuscript_types (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_id      UUID NOT NULL REFERENCES manuscript.journals(id),
    name            TEXT NOT NULL,               -- e.g. "Original Research"
    acronym         TEXT NOT NULL,               -- e.g. "OR"
    description     TEXT,
    -- Optional: graph node ID of the WorkflowDefinition used for this type
    workflow_graph_id TEXT,
    display_order   INT NOT NULL DEFAULT 0,      -- for UI ordering
    active          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (journal_id, acronym)
);

-- Index for journal-scoped lookups
CREATE INDEX manuscript_types_journal_idx
    ON manuscript.manuscript_types (journal_id, display_order);
