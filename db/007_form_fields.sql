-- =============================================================================
-- Migration 007 — Submission form fields
-- =============================================================================
-- Stores configurable form field definitions per journal.
-- Tier 1 fields (title, abstract, authors, files) are hardcoded in the UI.
-- This table covers Tier 2: toggleable standard fields + custom questions.
-- =============================================================================

CREATE TABLE manuscript.form_fields (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_id    UUID NOT NULL REFERENCES manuscript.journals(id),
    form_type     TEXT NOT NULL DEFAULT 'submission',  -- 'submission' | 'checklist' | 'signup'
    field_key     TEXT NOT NULL,      -- machine name used in payload JSONB
    label         TEXT NOT NULL,      -- displayed to author
    description   TEXT,              -- optional help text shown below the field
    field_type    TEXT NOT NULL DEFAULT 'boolean',  -- 'boolean' | 'text' | 'textarea' | 'select' | 'date' | 'file'
    options       JSONB,             -- for 'select': ["Option A", "Option B"]
    required      BOOLEAN NOT NULL DEFAULT false,
    display_order INT NOT NULL DEFAULT 0,
    active        BOOLEAN NOT NULL DEFAULT true,
    conditions    JSONB,             -- {"show_if": {"field": "manuscript_type", "value": "clinical_trial"}}
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (journal_id, form_type, field_key)
);

-- ---------------------------------------------------------------------------
-- Function: seed default submission fields for a journal
-- Call this when creating a new journal, or run once for existing journals.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION manuscript.seed_default_form_fields(p_journal_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO manuscript.form_fields
    (journal_id, form_type, field_key, label, description, field_type, required, display_order, active)
  VALUES
    (p_journal_id, 'submission', 'cover_letter',
      'Cover letter',
      'A brief letter to the editor explaining the significance of your work.',
      'textarea', false, 10, true),

    (p_journal_id, 'submission', 'coi_statement',
      'Conflict of interest statement',
      'Disclose any financial or personal relationships that could influence this work. Enter "None" if not applicable.',
      'textarea', true, 20, true),

    (p_journal_id, 'submission', 'ethics_declaration',
      'Ethics approval',
      'This study was conducted in accordance with applicable ethical standards and has received approval where required.',
      'boolean', false, 30, true),

    (p_journal_id, 'submission', 'data_availability',
      'Data availability statement',
      'Describe where the data supporting your findings can be accessed.',
      'textarea', false, 40, true),

    (p_journal_id, 'submission', 'funding',
      'Funding statement',
      'List the funding sources that supported this work. Enter "None" if not applicable.',
      'textarea', false, 50, true),

    (p_journal_id, 'submission', 'clinical_trial_registration',
      'Clinical trial registration number',
      'If this study is a clinical trial, provide the registration number (e.g. NCT12345678).',
      'text', false, 60, false),

    (p_journal_id, 'submission', 'suggested_reviewers',
      'Suggested reviewers',
      'Optionally suggest up to three reviewers with relevant expertise. The editor is not obligated to use your suggestions.',
      'textarea', false, 70, true),

    (p_journal_id, 'submission', 'excluded_reviewers',
      'Reviewers to exclude',
      'List any individuals who should not review this manuscript, with a brief reason.',
      'textarea', false, 80, false)

  ON CONFLICT (journal_id, form_type, field_key) DO NOTHING;
END;
$$;

-- Seed default fields for all existing journals
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM manuscript.journals LOOP
    PERFORM manuscript.seed_default_form_fields(r.id);
  END LOOP;
END;
$$;
