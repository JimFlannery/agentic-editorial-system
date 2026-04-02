-- =============================================================================
-- Editorial Management System — Seed Data
-- Creates one test journal with a minimal editorial team + one submission.
-- =============================================================================
-- Run via: bash db/seed.sh
-- Or manually: psql $DATABASE_URL -f db/seed.sql
-- =============================================================================

SET search_path = ag_catalog, "$user", public;
LOAD 'age';

-- ---------------------------------------------------------------------------
-- 1. Journal
-- ---------------------------------------------------------------------------
INSERT INTO manuscript.journals (id, name, issn, subject_area)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Journal of Open Research',
    '0000-0001',
    'Multidisciplinary'
);

-- ---------------------------------------------------------------------------
-- 2. People
-- ---------------------------------------------------------------------------
INSERT INTO manuscript.people (id, journal_id, email, full_name, orcid)
VALUES
    -- Editor-in-Chief
    ('00000000-0000-0000-0001-000000000001',
     '00000000-0000-0000-0000-000000000001',
     'eic@example.com', 'Dr. Eleanor Vance', '0000-0001-0001-0001'),
    -- Editor
    ('00000000-0000-0000-0001-000000000002',
     '00000000-0000-0000-0000-000000000001',
     'editor@example.com', 'Dr. Marcus Webb', '0000-0001-0001-0002'),
    -- Assistant Editor
    ('00000000-0000-0000-0001-000000000003',
     '00000000-0000-0000-0000-000000000001',
     'ae@example.com', 'Priya Sharma', NULL),
    -- Reviewers
    ('00000000-0000-0000-0001-000000000004',
     '00000000-0000-0000-0000-000000000001',
     'reviewer1@example.com', 'Prof. James Okafor', '0000-0001-0001-0004'),
    ('00000000-0000-0000-0001-000000000005',
     '00000000-0000-0000-0000-000000000001',
     'reviewer2@example.com', 'Dr. Lena Fischer', '0000-0001-0001-0005'),
    ('00000000-0000-0000-0001-000000000006',
     '00000000-0000-0000-0000-000000000001',
     'reviewer3@example.com', 'Dr. Tomás Reyes', NULL),
    -- Author
    ('00000000-0000-0000-0001-000000000007',
     '00000000-0000-0000-0000-000000000001',
     'author@example.com', 'Dr. Aiko Tanaka', '0000-0001-0001-0007');

-- ---------------------------------------------------------------------------
-- 3. Roles
-- ---------------------------------------------------------------------------
INSERT INTO manuscript.person_roles (person_id, journal_id, role)
VALUES
    ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001', 'editor_in_chief'),
    ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-000000000001', 'editor'),
    ('00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0000-000000000001', 'assistant_editor'),
    ('00000000-0000-0000-0001-000000000004', '00000000-0000-0000-0000-000000000001', 'reviewer'),
    ('00000000-0000-0000-0001-000000000005', '00000000-0000-0000-0000-000000000001', 'reviewer'),
    ('00000000-0000-0000-0001-000000000006', '00000000-0000-0000-0000-000000000001', 'reviewer'),
    ('00000000-0000-0000-0001-000000000007', '00000000-0000-0000-0000-000000000001', 'author');

-- ---------------------------------------------------------------------------
-- 4. Manuscript
-- ---------------------------------------------------------------------------
INSERT INTO manuscript.manuscripts
    (id, journal_id, title, abstract, subject_area, manuscript_type, status, submitted_by)
VALUES (
    '00000000-0000-0000-0002-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Adaptive Graph Traversal in Low-Latency Editorial Workflows',
    'This paper presents a novel approach to editorial workflow automation using property graphs...',
    'Computer Science',
    'research_article',
    'submitted',
    '00000000-0000-0000-0001-000000000007'
);

-- Assign the assistant editor to the manuscript
INSERT INTO manuscript.assignments (manuscript_id, person_id, role)
VALUES (
    '00000000-0000-0000-0002-000000000001',
    '00000000-0000-0000-0001-000000000003',
    'assistant_editor'
);

-- ---------------------------------------------------------------------------
-- 5. Graph nodes for the seed data
--    Mirror the relational rows as AGE nodes so Cypher queries work.
-- ---------------------------------------------------------------------------

SELECT * FROM cypher('ems_graph', $$
    CREATE (:Journal {
        sql_id: '00000000-0000-0000-0000-000000000001',
        name: 'Journal of Open Research',
        issn: '0000-0001',
        subject_area: 'Multidisciplinary'
    })
$$) AS (v agtype);

-- Note: Apache AGE supports only single labels per node.
-- Role is stored as a property instead of a second label.
SELECT * FROM cypher('ems_graph', $$
    CREATE (:Person {
        sql_id: '00000000-0000-0000-0001-000000000001',
        role: 'editor_in_chief',
        name: 'Dr. Eleanor Vance',
        email: 'eic@example.com'
    })
$$) AS (v agtype);

SELECT * FROM cypher('ems_graph', $$
    CREATE (:Person {
        sql_id: '00000000-0000-0000-0001-000000000002',
        role: 'editor',
        name: 'Dr. Marcus Webb',
        email: 'editor@example.com'
    })
$$) AS (v agtype);

SELECT * FROM cypher('ems_graph', $$
    CREATE (:Person {
        sql_id: '00000000-0000-0000-0001-000000000003',
        role: 'assistant_editor',
        name: 'Priya Sharma',
        email: 'ae@example.com'
    })
$$) AS (v agtype);

SELECT * FROM cypher('ems_graph', $$
    CREATE (:Person {
        sql_id: '00000000-0000-0000-0001-000000000004',
        role: 'reviewer',
        name: 'Prof. James Okafor',
        email: 'reviewer1@example.com',
        subject_area: 'Computer Science'
    })
$$) AS (v agtype);

SELECT * FROM cypher('ems_graph', $$
    CREATE (:Person {
        sql_id: '00000000-0000-0000-0001-000000000005',
        role: 'reviewer',
        name: 'Dr. Lena Fischer',
        email: 'reviewer2@example.com',
        subject_area: 'Computer Science'
    })
$$) AS (v agtype);

SELECT * FROM cypher('ems_graph', $$
    CREATE (:Person {
        sql_id: '00000000-0000-0000-0001-000000000006',
        role: 'reviewer',
        name: 'Dr. Tomás Reyes',
        email: 'reviewer3@example.com',
        subject_area: 'Multidisciplinary'
    })
$$) AS (v agtype);

SELECT * FROM cypher('ems_graph', $$
    CREATE (:Person {
        sql_id: '00000000-0000-0000-0001-000000000007',
        role: 'author',
        name: 'Dr. Aiko Tanaka',
        email: 'author@example.com'
    })
$$) AS (v agtype);

SELECT * FROM cypher('ems_graph', $$
    CREATE (:Manuscript {
        sql_id: '00000000-0000-0000-0002-000000000001',
        title: 'Adaptive Graph Traversal in Low-Latency Editorial Workflows',
        subject_area: 'Computer Science',
        status: 'submitted'
    })
$$) AS (v agtype);

-- Relationships
SELECT * FROM cypher('ems_graph', $$
    MATCH (a:Person {sql_id: '00000000-0000-0000-0001-000000000007'}),
          (m:Manuscript {sql_id: '00000000-0000-0000-0002-000000000001'})
    CREATE (a)-[:SUBMITTED]->(m)
$$) AS (v agtype);

SELECT * FROM cypher('ems_graph', $$
    MATCH (ae:Person {sql_id: '00000000-0000-0000-0001-000000000003'}),
          (m:Manuscript {sql_id: '00000000-0000-0000-0002-000000000001'})
    CREATE (ae)-[:ASSIGNED_TO]->(m)
$$) AS (v agtype);

-- ---------------------------------------------------------------------------
-- 6. Seed event
-- ---------------------------------------------------------------------------
INSERT INTO history.events (journal_id, manuscript_id, event_type, actor_id, actor_type, payload)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0002-000000000001',
    'manuscript.submitted',
    '00000000-0000-0000-0001-000000000007',
    'person',
    '{"title": "Adaptive Graph Traversal in Low-Latency Editorial Workflows"}'
);
