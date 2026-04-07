-- =============================================================================
-- Migration 010 — Manuscript tracking numbers
-- =============================================================================
-- Adds ScholarOne-style tracking numbers to manuscripts:
--   [ACRONYM]-[YEAR]-[#####]            (e.g. TEST-2026-00003)
--   [ACRONYM]-[YEAR]-[#####].R[N]       (e.g. TEST-2026-00003.R2)
-- Sequence is zero-padded to 5 digits, supporting up to 99,999/year before
-- the digit count grows (the function still works beyond that).
--
-- Each (journal, year) gets its own sequence so numbers reset annually.
-- Run via: bash db/010_tracking_number.sh
-- =============================================================================

ALTER TABLE manuscript.manuscripts
    ADD COLUMN IF NOT EXISTS tracking_number TEXT,
    ADD COLUMN IF NOT EXISTS revision_number INT NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS manuscripts_tracking_number_unique
    ON manuscript.manuscripts (journal_id, tracking_number)
    WHERE tracking_number IS NOT NULL;

-- Per-(journal, year) sequence counter. We avoid PostgreSQL SEQUENCEs because
-- we need a separate counter for every (journal, year) pair, which would
-- require dynamically created sequences.
CREATE TABLE IF NOT EXISTS manuscript.tracking_counters (
    journal_id  UUID NOT NULL REFERENCES manuscript.journals(id) ON DELETE CASCADE,
    year        INT  NOT NULL,
    last_seq    INT  NOT NULL DEFAULT 0,
    PRIMARY KEY (journal_id, year)
);

-- Atomically allocate and return the next tracking number for a journal.
-- Format: ACRONYM-YYYY-NNNNN  (sequence is zero-padded to 5 digits, but
-- naturally grows beyond 5 digits if a journal exceeds 99999/year).
CREATE OR REPLACE FUNCTION manuscript.next_tracking_number(p_journal_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_year    INT  := EXTRACT(YEAR FROM now())::INT;
    v_seq     INT;
    v_acronym TEXT;
BEGIN
    SELECT acronym INTO v_acronym
    FROM manuscript.journals
    WHERE id = p_journal_id;

    IF v_acronym IS NULL THEN
        RAISE EXCEPTION 'Journal % has no acronym', p_journal_id;
    END IF;

    INSERT INTO manuscript.tracking_counters (journal_id, year, last_seq)
    VALUES (p_journal_id, v_year, 1)
    ON CONFLICT (journal_id, year)
    DO UPDATE SET last_seq = manuscript.tracking_counters.last_seq + 1
    RETURNING last_seq INTO v_seq;

    RETURN v_acronym || '-' || v_year::TEXT || '-' || LPAD(v_seq::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Backfill existing manuscripts that have no tracking_number.
-- Numbered in submission order, grouped by (journal, submission year).
DO $$
DECLARE
    r RECORD;
    v_seq INT;
    v_prev_journal UUID;
    v_prev_year INT;
BEGIN
    v_prev_journal := NULL;
    v_prev_year := NULL;
    v_seq := 0;

    FOR r IN
        SELECT m.id,
               m.journal_id,
               EXTRACT(YEAR FROM m.submitted_at)::INT AS year,
               j.acronym
        FROM manuscript.manuscripts m
        JOIN manuscript.journals j ON j.id = m.journal_id
        WHERE m.tracking_number IS NULL
        ORDER BY m.journal_id, EXTRACT(YEAR FROM m.submitted_at), m.submitted_at
    LOOP
        IF r.journal_id IS DISTINCT FROM v_prev_journal OR r.year IS DISTINCT FROM v_prev_year THEN
            -- Resume from existing counter (if any) so future allocations don't collide
            v_seq := COALESCE(
                (SELECT last_seq FROM manuscript.tracking_counters
                 WHERE journal_id = r.journal_id AND year = r.year),
                0
            );
            v_prev_journal := r.journal_id;
            v_prev_year := r.year;
        END IF;

        v_seq := v_seq + 1;

        UPDATE manuscript.manuscripts
        SET tracking_number = r.acronym || '-' || r.year::TEXT || '-' || LPAD(v_seq::TEXT, 5, '0')
        WHERE id = r.id;

        INSERT INTO manuscript.tracking_counters (journal_id, year, last_seq)
        VALUES (r.journal_id, r.year, v_seq)
        ON CONFLICT (journal_id, year)
        DO UPDATE SET last_seq = v_seq;
    END LOOP;
END $$;
