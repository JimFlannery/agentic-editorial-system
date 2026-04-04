-- =============================================================================
-- Migration 006 — Add journal_admin to person_role enum
-- =============================================================================
-- journal_admin: can configure a specific journal (workflows, users, templates).
-- Distinct from system_admin (manages the entire installation).
-- Assignable by: existing journal_admins on that journal, or system_admins.
-- =============================================================================

ALTER TYPE manuscript.person_role ADD VALUE IF NOT EXISTS 'journal_admin';
