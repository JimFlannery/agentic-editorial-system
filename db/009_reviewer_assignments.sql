-- =============================================================================
-- Migration 009 — reviewer invitation tracking
-- =============================================================================

-- Add invitation lifecycle columns to manuscript.assignments.
-- invitation_status tracks where in the invitation flow each assignment sits.
ALTER TABLE manuscript.assignments
  ADD COLUMN IF NOT EXISTS invitation_status TEXT NOT NULL DEFAULT 'invited',
  ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;

-- Constraint so only valid statuses can be stored.
ALTER TABLE manuscript.assignments
  ADD CONSTRAINT assignments_invitation_status_check
    CHECK (invitation_status IN ('invited', 'accepted', 'declined', 'completed'));
