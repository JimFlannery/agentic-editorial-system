-- =============================================================================
-- Editorial Management System — Full Test Seed
--
-- Creates two journals with complete editorial teams, manuscript types,
-- manuscripts in various states, and mirrored graph nodes.
--
-- Idempotent: deletes all seed rows before inserting, safe to re-run.
-- =============================================================================
-- Run via: bash db/seed_full.sh
-- =============================================================================

SET search_path = ag_catalog, "$user", public;
LOAD 'age';

-- =============================================================================
-- 0. Clean up existing seed data (FK order: children before parents)
-- =============================================================================

DELETE FROM history.events
WHERE journal_id IN (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002'
);

DELETE FROM manuscript.assignments
WHERE manuscript_id IN (
    '00000000-0000-0000-0003-000000000001',
    '00000000-0000-0000-0003-000000000002',
    '00000000-0000-0000-0003-000000000003'
);

DELETE FROM manuscript.manuscripts
WHERE journal_id IN (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002'
);

DELETE FROM manuscript.manuscript_types
WHERE journal_id IN (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002'
);

DELETE FROM manuscript.person_roles
WHERE journal_id IN (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002'
);

DELETE FROM manuscript.people
WHERE journal_id IN (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002'
);

DELETE FROM manuscript.journals
WHERE id IN (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002'
);

-- Wipe all graph nodes so we can recreate cleanly
SELECT * FROM cypher('ems_graph', $$
    MATCH (n) DETACH DELETE n
$$) AS (v agtype);

-- =============================================================================
-- 1. Journals
-- =============================================================================

INSERT INTO manuscript.journals (id, name, acronym, issn, subject_area) VALUES
    ('00000000-0000-0000-0000-000000000001',
     'Journal of Open Research',
     'TEST',
     '2345-6789',
     'Multidisciplinary'),

    ('00000000-0000-0000-0000-000000000002',
     'Computational Biology Review',
     'CBR',
     '1234-5678',
     'Computational Biology');

-- =============================================================================
-- 2. People
-- =============================================================================

-- --- Journal of Open Research (JOR) ---

INSERT INTO manuscript.people (id, journal_id, email, full_name, orcid) VALUES
    ('00000000-0000-0000-0001-000000000001',
     '00000000-0000-0000-0000-000000000001',
     'eic@jor.example.com', 'Dr. Eleanor Vance', '0000-0001-0001-0001'),

    ('00000000-0000-0000-0001-000000000002',
     '00000000-0000-0000-0000-000000000001',
     'editor@jor.example.com', 'Dr. Marcus Webb', '0000-0001-0001-0002'),

    ('00000000-0000-0000-0001-000000000003',
     '00000000-0000-0000-0000-000000000001',
     'ae@jor.example.com', 'Priya Sharma', NULL),

    ('00000000-0000-0000-0001-000000000004',
     '00000000-0000-0000-0000-000000000001',
     'reviewer1@jor.example.com', 'Prof. James Okafor', '0000-0001-0001-0004'),

    ('00000000-0000-0000-0001-000000000005',
     '00000000-0000-0000-0000-000000000001',
     'reviewer2@jor.example.com', 'Dr. Lena Fischer', '0000-0001-0001-0005'),

    ('00000000-0000-0000-0001-000000000006',
     '00000000-0000-0000-0000-000000000001',
     'reviewer3@jor.example.com', 'Dr. Tomas Reyes', NULL),

    ('00000000-0000-0000-0001-000000000007',
     '00000000-0000-0000-0000-000000000001',
     'author1@jor.example.com', 'Dr. Aiko Tanaka', '0000-0001-0001-0007'),

    ('00000000-0000-0000-0001-000000000008',
     '00000000-0000-0000-0000-000000000001',
     'author2@jor.example.com', 'Dr. Samuel Obi', '0000-0001-0001-0008');

-- --- Computational Biology Review (CBR) ---

INSERT INTO manuscript.people (id, journal_id, email, full_name, orcid) VALUES
    ('00000000-0000-0000-0002-000000000001',
     '00000000-0000-0000-0000-000000000002',
     'eic@cbr.example.com', 'Prof. Rafael Santos', '0000-0002-0001-0001'),

    ('00000000-0000-0000-0002-000000000002',
     '00000000-0000-0000-0000-000000000002',
     'editor@cbr.example.com', 'Dr. Yuki Nakamura', '0000-0002-0001-0002'),

    ('00000000-0000-0000-0002-000000000003',
     '00000000-0000-0000-0000-000000000002',
     'ae@cbr.example.com', 'Sarah Chen', NULL),

    ('00000000-0000-0000-0002-000000000004',
     '00000000-0000-0000-0000-000000000002',
     'reviewer1@cbr.example.com', 'Dr. Kwame Asante', '0000-0002-0001-0004'),

    ('00000000-0000-0000-0002-000000000005',
     '00000000-0000-0000-0000-000000000002',
     'reviewer2@cbr.example.com', 'Dr. Maria Gonzalez', '0000-0002-0001-0005'),

    ('00000000-0000-0000-0002-000000000006',
     '00000000-0000-0000-0000-000000000002',
     'reviewer3@cbr.example.com', 'Dr. Ivan Petrov', NULL),

    ('00000000-0000-0000-0002-000000000007',
     '00000000-0000-0000-0000-000000000002',
     'author@cbr.example.com', 'Dr. Fatima Al-Hassan', '0000-0002-0001-0007');

-- =============================================================================
-- 3. Person roles
-- =============================================================================

INSERT INTO manuscript.person_roles (person_id, journal_id, role) VALUES
    -- JOR
    ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001', 'editor_in_chief'),
    ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-000000000001', 'editor'),
    ('00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0000-000000000001', 'assistant_editor'),
    ('00000000-0000-0000-0001-000000000004', '00000000-0000-0000-0000-000000000001', 'reviewer'),
    ('00000000-0000-0000-0001-000000000005', '00000000-0000-0000-0000-000000000001', 'reviewer'),
    ('00000000-0000-0000-0001-000000000006', '00000000-0000-0000-0000-000000000001', 'reviewer'),
    ('00000000-0000-0000-0001-000000000007', '00000000-0000-0000-0000-000000000001', 'author'),
    ('00000000-0000-0000-0001-000000000008', '00000000-0000-0000-0000-000000000001', 'author'),
    -- CBR
    ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0000-000000000002', 'editor_in_chief'),
    ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0000-000000000002', 'editor'),
    ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0000-000000000002', 'assistant_editor'),
    ('00000000-0000-0000-0002-000000000004', '00000000-0000-0000-0000-000000000002', 'reviewer'),
    ('00000000-0000-0000-0002-000000000005', '00000000-0000-0000-0000-000000000002', 'reviewer'),
    ('00000000-0000-0000-0002-000000000006', '00000000-0000-0000-0000-000000000002', 'reviewer'),
    ('00000000-0000-0000-0002-000000000007', '00000000-0000-0000-0000-000000000002', 'author');

-- =============================================================================
-- 4. Manuscript types
-- =============================================================================

INSERT INTO manuscript.manuscript_types
    (id, journal_id, name, acronym, description, display_order) VALUES
    -- JOR
    ('00000000-0000-0000-0004-000000000001',
     '00000000-0000-0000-0000-000000000001',
     'Original Research Article', 'ORA',
     'Full-length primary research presenting new findings.',
     1),

    ('00000000-0000-0000-0004-000000000002',
     '00000000-0000-0000-0000-000000000001',
     'Review Article', 'REV',
     'Comprehensive review of existing literature on a topic.',
     2),

    ('00000000-0000-0000-0004-000000000003',
     '00000000-0000-0000-0000-000000000001',
     'Case Study', 'CS',
     'In-depth analysis of a specific instance or event.',
     3),

    ('00000000-0000-0000-0004-000000000004',
     '00000000-0000-0000-0000-000000000001',
     'Short Communication', 'SC',
     'Brief reports of significant new findings.',
     4),

    -- CBR
    ('00000000-0000-0000-0004-000000000005',
     '00000000-0000-0000-0000-000000000002',
     'Research Article', 'RA',
     'Primary research in computational biology.',
     1),

    ('00000000-0000-0000-0004-000000000006',
     '00000000-0000-0000-0000-000000000002',
     'Methods Paper', 'MP',
     'Description and validation of a new computational method.',
     2),

    ('00000000-0000-0000-0004-000000000007',
     '00000000-0000-0000-0000-000000000002',
     'Letter', 'LET',
     'Short communications on significant findings.',
     3);

-- =============================================================================
-- 5. Manuscripts
-- =============================================================================

INSERT INTO manuscript.manuscripts
    (id, journal_id, title, abstract, subject_area, manuscript_type, status, submitted_by)
VALUES
    -- JOR: newly submitted
    ('00000000-0000-0000-0003-000000000001',
     '00000000-0000-0000-0000-000000000001',
     'Adaptive Graph Traversal in Low-Latency Editorial Workflows',
     'This paper presents a novel approach to editorial workflow automation using property graphs. We demonstrate that representing workflows as directed graphs enables dynamic reconfiguration without code changes.',
     'Computer Science',
     'research_article',
     'submitted',
     '00000000-0000-0000-0001-000000000007'),

    -- JOR: under review
    ('00000000-0000-0000-0003-000000000002',
     '00000000-0000-0000-0000-000000000001',
     'Open Peer Review and Its Effect on Review Quality in Multidisciplinary Journals',
     'We report a longitudinal study of 1,200 manuscripts across five journals comparing blind, single-blind, and open peer review, measuring review quality by structured rubric.',
     'Science Policy',
     'review_article',
     'under_review',
     '00000000-0000-0000-0001-000000000008'),

    -- CBR: newly submitted
    ('00000000-0000-0000-0003-000000000003',
     '00000000-0000-0000-0000-000000000002',
     'ProteinFoldNet: A Graph Neural Network for Ab Initio Structure Prediction',
     'We introduce ProteinFoldNet, a GNN architecture that predicts tertiary protein structure from amino acid sequence with state-of-the-art accuracy on the CASP15 benchmark.',
     'Structural Bioinformatics',
     'research_article',
     'submitted',
     '00000000-0000-0000-0002-000000000007');

-- =============================================================================
-- 6. Assignments
-- =============================================================================

INSERT INTO manuscript.assignments (manuscript_id, person_id, role) VALUES
    -- JOR manuscript 1: AE assigned
    ('00000000-0000-0000-0003-000000000001',
     '00000000-0000-0000-0001-000000000003',
     'assistant_editor'),

    -- JOR manuscript 2: AE and three reviewers
    ('00000000-0000-0000-0003-000000000002',
     '00000000-0000-0000-0001-000000000003',
     'assistant_editor'),
    ('00000000-0000-0000-0003-000000000002',
     '00000000-0000-0000-0001-000000000004',
     'reviewer'),
    ('00000000-0000-0000-0003-000000000002',
     '00000000-0000-0000-0001-000000000005',
     'reviewer'),
    ('00000000-0000-0000-0003-000000000002',
     '00000000-0000-0000-0001-000000000006',
     'reviewer'),

    -- CBR manuscript 3: AE assigned
    ('00000000-0000-0000-0003-000000000003',
     '00000000-0000-0000-0002-000000000003',
     'assistant_editor');

-- =============================================================================
-- 7. Graph nodes — mirror all relational rows as AGE nodes
-- =============================================================================

-- Journals
SELECT * FROM cypher('ems_graph', $$
    CREATE (:Journal {sql_id: '00000000-0000-0000-0000-000000000001',
                      name: 'Journal of Open Research',
                      issn: '2345-6789',
                      subject_area: 'Multidisciplinary'})
$$) AS (v agtype);

SELECT * FROM cypher('ems_graph', $$
    CREATE (:Journal {sql_id: '00000000-0000-0000-0000-000000000002',
                      name: 'Computational Biology Review',
                      issn: '1234-5678',
                      subject_area: 'Computational Biology'})
$$) AS (v agtype);

-- JOR people
SELECT * FROM cypher('ems_graph', $$
    CREATE (:Person {sql_id: '00000000-0000-0000-0001-000000000001',
                     journal_id: '00000000-0000-0000-0000-000000000001',
                     role: 'editor_in_chief',
                     name: 'Dr. Eleanor Vance',
                     email: 'eic@jor.example.com'})
$$) AS (v agtype);

SELECT * FROM cypher('ems_graph', $$
    CREATE (:Person {sql_id: '00000000-0000-0000-0001-000000000002',
                     journal_id: '00000000-0000-0000-0000-000000000001',
                     role: 'editor',
                     name: 'Dr. Marcus Webb',
                     email: 'editor@jor.example.com'})
$$) AS (v agtype);

SELECT * FROM cypher('ems_graph', $$
    CREATE (:Person {sql_id: '00000000-0000-0000-0001-000000000003',
                     journal_id: '00000000-0000-0000-0000-000000000001',
                     role: 'assistant_editor',
                     name: 'Priya Sharma',
                     email: 'ae@jor.example.com'})
$$) AS (v agtype);

SELECT * FROM cypher('ems_graph', $$
    CREATE (:Person {sql_id: '00000000-0000-0000-0001-000000000004',
                     journal_id: '00000000-0000-0000-0000-000000000001',
                     role: 'reviewer',
                     name: 'Prof. James Okafor',
                     email: 'reviewer1@jor.example.com',
                     subject_area: 'Computer Science'})
$$) AS (v agtype);

SELECT * FROM cypher('ems_graph', $$
    CREATE (:Person {sql_id: '00000000-0000-0000-0001-000000000005',
                     journal_id: '00000000-0000-0000-0000-000000000001',
                     role: 'reviewer',
                     name: 'Dr. Lena Fischer',
                     email: 'reviewer2@jor.example.com',
                     subject_area: 'Computer Science'})
$$) AS (v agtype);

SELECT * FROM cypher('ems_graph', $$
    CREATE (:Person {sql_id: '00000000-0000-0000-0001-000000000006',
                     journal_id: '00000000-0000-0000-0000-000000000001',
                     role: 'reviewer',
                     name: 'Dr. Tomas Reyes',
                     email: 'reviewer3@jor.example.com',
                     subject_area: 'Multidisciplinary'})
$$) AS (v agtype);

SELECT * FROM cypher('ems_graph', $$
    CREATE (:Person {sql_id: '00000000-0000-0000-0001-000000000007',
                     journal_id: '00000000-0000-0000-0000-000000000001',
                     role: 'author',
                     name: 'Dr. Aiko Tanaka',
                     email: 'author1@jor.example.com'})
$$) AS (v agtype);

SELECT * FROM cypher('ems_graph', $$
    CREATE (:Person {sql_id: '00000000-0000-0000-0001-000000000008',
                     journal_id: '00000000-0000-0000-0000-000000000001',
                     role: 'author',
                     name: 'Dr. Samuel Obi',
                     email: 'author2@jor.example.com'})
$$) AS (v agtype);

-- CBR people
SELECT * FROM cypher('ems_graph', $$
    CREATE (:Person {sql_id: '00000000-0000-0000-0002-000000000001',
                     journal_id: '00000000-0000-0000-0000-000000000002',
                     role: 'editor_in_chief',
                     name: 'Prof. Rafael Santos',
                     email: 'eic@cbr.example.com'})
$$) AS (v agtype);

SELECT * FROM cypher('ems_graph', $$
    CREATE (:Person {sql_id: '00000000-0000-0000-0002-000000000002',
                     journal_id: '00000000-0000-0000-0000-000000000002',
                     role: 'editor',
                     name: 'Dr. Yuki Nakamura',
                     email: 'editor@cbr.example.com'})
$$) AS (v agtype);

SELECT * FROM cypher('ems_graph', $$
    CREATE (:Person {sql_id: '00000000-0000-0000-0002-000000000003',
                     journal_id: '00000000-0000-0000-0000-000000000002',
                     role: 'assistant_editor',
                     name: 'Sarah Chen',
                     email: 'ae@cbr.example.com'})
$$) AS (v agtype);

SELECT * FROM cypher('ems_graph', $$
    CREATE (:Person {sql_id: '00000000-0000-0000-0002-000000000004',
                     journal_id: '00000000-0000-0000-0000-000000000002',
                     role: 'reviewer',
                     name: 'Dr. Kwame Asante',
                     email: 'reviewer1@cbr.example.com',
                     subject_area: 'Computational Biology'})
$$) AS (v agtype);

SELECT * FROM cypher('ems_graph', $$
    CREATE (:Person {sql_id: '00000000-0000-0000-0002-000000000005',
                     journal_id: '00000000-0000-0000-0000-000000000002',
                     role: 'reviewer',
                     name: 'Dr. Maria Gonzalez',
                     email: 'reviewer2@cbr.example.com',
                     subject_area: 'Structural Bioinformatics'})
$$) AS (v agtype);

SELECT * FROM cypher('ems_graph', $$
    CREATE (:Person {sql_id: '00000000-0000-0000-0002-000000000006',
                     journal_id: '00000000-0000-0000-0000-000000000002',
                     role: 'reviewer',
                     name: 'Dr. Ivan Petrov',
                     email: 'reviewer3@cbr.example.com',
                     subject_area: 'Computational Biology'})
$$) AS (v agtype);

SELECT * FROM cypher('ems_graph', $$
    CREATE (:Person {sql_id: '00000000-0000-0000-0002-000000000007',
                     journal_id: '00000000-0000-0000-0000-000000000002',
                     role: 'author',
                     name: 'Dr. Fatima Al-Hassan',
                     email: 'author@cbr.example.com'})
$$) AS (v agtype);

-- Manuscripts
SELECT * FROM cypher('ems_graph', $$
    CREATE (:Manuscript {sql_id: '00000000-0000-0000-0003-000000000001',
                         journal_id: '00000000-0000-0000-0000-000000000001',
                         title: 'Adaptive Graph Traversal in Low-Latency Editorial Workflows',
                         subject_area: 'Computer Science',
                         status: 'submitted'})
$$) AS (v agtype);

SELECT * FROM cypher('ems_graph', $$
    CREATE (:Manuscript {sql_id: '00000000-0000-0000-0003-000000000002',
                         journal_id: '00000000-0000-0000-0000-000000000001',
                         title: 'Open Peer Review and Its Effect on Review Quality in Multidisciplinary Journals',
                         subject_area: 'Science Policy',
                         status: 'under_review'})
$$) AS (v agtype);

SELECT * FROM cypher('ems_graph', $$
    CREATE (:Manuscript {sql_id: '00000000-0000-0000-0003-000000000003',
                         journal_id: '00000000-0000-0000-0000-000000000002',
                         title: 'ProteinFoldNet: A Graph Neural Network for Ab Initio Structure Prediction',
                         subject_area: 'Structural Bioinformatics',
                         status: 'submitted'})
$$) AS (v agtype);

-- =============================================================================
-- 8. Graph relationships
-- =============================================================================

-- Manuscript 1: author submitted, AE assigned
SELECT * FROM cypher('ems_graph', $$
    MATCH (a:Person {sql_id: '00000000-0000-0000-0001-000000000007'}),
          (m:Manuscript {sql_id: '00000000-0000-0000-0003-000000000001'})
    CREATE (a)-[:SUBMITTED]->(m)
$$) AS (v agtype);

SELECT * FROM cypher('ems_graph', $$
    MATCH (ae:Person {sql_id: '00000000-0000-0000-0001-000000000003'}),
          (m:Manuscript {sql_id: '00000000-0000-0000-0003-000000000001'})
    CREATE (ae)-[:ASSIGNED_TO]->(m)
$$) AS (v agtype);

-- Manuscript 2: author submitted, AE assigned, 3 reviewers invited
SELECT * FROM cypher('ems_graph', $$
    MATCH (a:Person {sql_id: '00000000-0000-0000-0001-000000000008'}),
          (m:Manuscript {sql_id: '00000000-0000-0000-0003-000000000002'})
    CREATE (a)-[:SUBMITTED]->(m)
$$) AS (v agtype);

SELECT * FROM cypher('ems_graph', $$
    MATCH (ae:Person {sql_id: '00000000-0000-0000-0001-000000000003'}),
          (m:Manuscript {sql_id: '00000000-0000-0000-0003-000000000002'})
    CREATE (ae)-[:ASSIGNED_TO]->(m)
$$) AS (v agtype);

SELECT * FROM cypher('ems_graph', $$
    MATCH (r:Person {sql_id: '00000000-0000-0000-0001-000000000004'}),
          (m:Manuscript {sql_id: '00000000-0000-0000-0003-000000000002'})
    CREATE (r)-[:INVITED_TO_REVIEW]->(m)
$$) AS (v agtype);

SELECT * FROM cypher('ems_graph', $$
    MATCH (r:Person {sql_id: '00000000-0000-0000-0001-000000000005'}),
          (m:Manuscript {sql_id: '00000000-0000-0000-0003-000000000002'})
    CREATE (r)-[:INVITED_TO_REVIEW]->(m)
$$) AS (v agtype);

SELECT * FROM cypher('ems_graph', $$
    MATCH (r:Person {sql_id: '00000000-0000-0000-0001-000000000006'}),
          (m:Manuscript {sql_id: '00000000-0000-0000-0003-000000000002'})
    CREATE (r)-[:INVITED_TO_REVIEW]->(m)
$$) AS (v agtype);

-- Manuscript 3 (CBR): author submitted, AE assigned
SELECT * FROM cypher('ems_graph', $$
    MATCH (a:Person {sql_id: '00000000-0000-0000-0002-000000000007'}),
          (m:Manuscript {sql_id: '00000000-0000-0000-0003-000000000003'})
    CREATE (a)-[:SUBMITTED]->(m)
$$) AS (v agtype);

SELECT * FROM cypher('ems_graph', $$
    MATCH (ae:Person {sql_id: '00000000-0000-0000-0002-000000000003'}),
          (m:Manuscript {sql_id: '00000000-0000-0000-0003-000000000003'})
    CREATE (ae)-[:ASSIGNED_TO]->(m)
$$) AS (v agtype);

-- =============================================================================
-- 9. History events
-- =============================================================================

INSERT INTO history.events (journal_id, manuscript_id, event_type, actor_id, actor_type, payload)
VALUES
    -- Manuscript 1 submitted
    ('00000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0003-000000000001',
     'manuscript.submitted',
     '00000000-0000-0000-0001-000000000007',
     'person',
     '{"title": "Adaptive Graph Traversal in Low-Latency Editorial Workflows", "type": "research_article"}'),

    -- Manuscript 1 assigned to AE
    ('00000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0003-000000000001',
     'manuscript.assigned',
     '00000000-0000-0000-0001-000000000001',
     'person',
     '{"assignee_id": "00000000-0000-0000-0001-000000000003", "role": "assistant_editor"}'),

    -- Manuscript 2 submitted
    ('00000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0003-000000000002',
     'manuscript.submitted',
     '00000000-0000-0000-0001-000000000008',
     'person',
     '{"title": "Open Peer Review and Its Effect on Review Quality in Multidisciplinary Journals", "type": "review_article"}'),

    -- Manuscript 2: reviewers invited
    ('00000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0003-000000000002',
     'reviewer.invited',
     '00000000-0000-0000-0001-000000000003',
     'person',
     '{"reviewer_ids": ["00000000-0000-0000-0001-000000000004", "00000000-0000-0000-0001-000000000005", "00000000-0000-0000-0001-000000000006"], "deadline_days": 21}'),

    -- Manuscript 3 submitted (CBR)
    ('00000000-0000-0000-0000-000000000002',
     '00000000-0000-0000-0003-000000000003',
     'manuscript.submitted',
     '00000000-0000-0000-0002-000000000007',
     'person',
     '{"title": "ProteinFoldNet: A Graph Neural Network for Ab Initio Structure Prediction", "type": "research_article"}');
