-- =============================================================================
-- Editorial Management System — Database Initialisation
-- PostgreSQL + Apache AGE
-- =============================================================================
-- Run via: bash db/migrate.sh
-- Or manually: psql $DATABASE_URL -f db/init.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Apache AGE extension
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS age;
LOAD 'age';
SET search_path = ag_catalog, "$user", public;

-- ---------------------------------------------------------------------------
-- 2. Property graph
--    All workflow definitions, gate nodes, reviewer pools, email templates,
--    and participant relationships live here as Cypher-queryable nodes/edges.
-- ---------------------------------------------------------------------------
SELECT create_graph('ems_graph');

-- ---------------------------------------------------------------------------
-- 3. Schemas
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS manuscript;  -- relational: people, journals, submissions
CREATE SCHEMA IF NOT EXISTS history;     -- append-only audit log

-- ---------------------------------------------------------------------------
-- 4. manuscript schema — relational tables
-- ---------------------------------------------------------------------------

CREATE TABLE manuscript.journals (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    issn          TEXT,
    subject_area  TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE manuscript.people (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_id    UUID NOT NULL REFERENCES manuscript.journals(id),
    email         TEXT NOT NULL,
    full_name     TEXT NOT NULL,
    orcid         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (journal_id, email)
);

-- Roles a person holds within a journal (multiple rows = multiple roles)
CREATE TYPE manuscript.person_role AS ENUM (
    'author',
    'reviewer',
    'assistant_editor',
    'editor',
    'editor_in_chief',
    'editorial_support',
    'system_admin'
);

CREATE TABLE manuscript.person_roles (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id     UUID NOT NULL REFERENCES manuscript.people(id),
    journal_id    UUID NOT NULL REFERENCES manuscript.journals(id),
    role          manuscript.person_role NOT NULL,
    granted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (person_id, journal_id, role)
);

CREATE TYPE manuscript.submission_status AS ENUM (
    'submitted',
    'under_review',
    'revision_requested',
    'accepted',
    'rejected',
    'withdrawn'
);

CREATE TABLE manuscript.manuscripts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_id      UUID NOT NULL REFERENCES manuscript.journals(id),
    title           TEXT NOT NULL,
    abstract        TEXT,
    subject_area    TEXT,
    manuscript_type TEXT NOT NULL DEFAULT 'research_article',
    status          manuscript.submission_status NOT NULL DEFAULT 'submitted',
    submitted_by    UUID NOT NULL REFERENCES manuscript.people(id),
    -- graph node ID for this manuscript in ems_graph
    graph_node_id   BIGINT,
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Assignments: who is assigned to what manuscript in what role
CREATE TABLE manuscript.assignments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manuscript_id   UUID NOT NULL REFERENCES manuscript.manuscripts(id),
    person_id       UUID NOT NULL REFERENCES manuscript.people(id),
    role            manuscript.person_role NOT NULL,
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    released_at     TIMESTAMPTZ,   -- null = still active
    UNIQUE (manuscript_id, person_id, role)
);

-- ---------------------------------------------------------------------------
-- 5. history schema — append-only event log
--    Every gate evaluation, state transition, and agent action is recorded.
-- ---------------------------------------------------------------------------

CREATE TABLE history.events (
    id              BIGSERIAL PRIMARY KEY,
    journal_id      UUID NOT NULL,
    manuscript_id   UUID,
    event_type      TEXT NOT NULL,   -- e.g. 'gate.evaluated', 'status.changed', 'agent.action'
    actor_id        UUID,            -- person or agent that caused the event
    actor_type      TEXT,            -- 'person' | 'agent'
    payload         JSONB,           -- event-specific data
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial index: fast lookups per manuscript
CREATE INDEX history_events_manuscript_idx
    ON history.events (manuscript_id, occurred_at DESC)
    WHERE manuscript_id IS NOT NULL;

CREATE INDEX history_events_journal_idx
    ON history.events (journal_id, occurred_at DESC);

-- ---------------------------------------------------------------------------
-- 6. Trigger: keep manuscripts.updated_at current
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION manuscript.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER manuscripts_updated_at
    BEFORE UPDATE ON manuscript.manuscripts
    FOR EACH ROW EXECUTE FUNCTION manuscript.set_updated_at();
