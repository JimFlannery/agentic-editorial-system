-- =============================================================================
-- TEST journal seed
--
-- Creates a fully-populated test journal ("Journal for Testing AgenticES",
-- acronym TEST) with a complete editorial team, reviewers, authors, and
-- manuscripts covering every workflow state.
--
-- Designed for E2E and Puppeteer tests. Safe to re-run — deletes all rows
-- scoped to the TEST journal before inserting.
--
-- Credentials (all test users share the same password):
--   Password: password
--   Bcrypt hash ($2a$10, cost 10): see PASS_HASH below
--
-- User accounts:
--   eic@test.example.com        — Editor-in-Chief
--   editor@test.example.com     — Editor
--   ae@test.example.com         — Assistant Editor
--   support@test.example.com    — Editorial Support
--   reviewer1@test.example.com  — Reviewer
--   reviewer2@test.example.com  — Reviewer
--   reviewer3@test.example.com  — Reviewer
--   author1@test.example.com    — Author
--   author2@test.example.com    — Author
--   author3@test.example.com    — Author
--
-- Manuscripts (all in journal TEST):
--   MS-1  submitted         — no checklist yet
--   MS-2  submitted         — checklist: pass
--   MS-3  submitted         — checklist: needs_human_review
--   MS-4  under_review      — 3 reviewers invited, none responded (stalled >14d)
--   MS-5  under_review      — 2 of 3 reviewers submitted (stalled >14d)
--   MS-6  revision_requested — major revision sent to author
--   MS-7  accepted
--   MS-8  rejected
-- =============================================================================

-- =============================================================================
-- ID constants (all scoped to TEST journal to avoid collisions)
-- =============================================================================
-- Journal:   99000000-0000-0000-0000-000000000001
-- People:    99000000-0000-0000-0001-0000000000XX  (01–10)
-- ManTypes:  99000000-0000-0000-0003-0000000000XX  (01–03)
-- Manuscripts: 99000000-0000-0000-0002-0000000000XX (01–08)
-- Auth users: text IDs (test-u-*) — Better Auth uses TEXT not UUID

-- =============================================================================
-- 0. Clean up — delete all prior seed rows for the TEST journal
-- =============================================================================

DELETE FROM history.events
WHERE journal_id = '99000000-0000-0000-0000-000000000001';

DELETE FROM manuscript.manuscript_authors
WHERE manuscript_id IN (
    SELECT id FROM manuscript.manuscripts
    WHERE journal_id = '99000000-0000-0000-0000-000000000001'
);

DELETE FROM manuscript.assignments
WHERE manuscript_id IN (
    SELECT id FROM manuscript.manuscripts
    WHERE journal_id = '99000000-0000-0000-0000-000000000001'
);

DELETE FROM manuscript.manuscripts
WHERE journal_id = '99000000-0000-0000-0000-000000000001';

DELETE FROM manuscript.manuscript_types
WHERE journal_id = '99000000-0000-0000-0000-000000000001';

DELETE FROM manuscript.person_roles
WHERE journal_id = '99000000-0000-0000-0000-000000000001';

-- Unlink people from auth accounts before deleting
UPDATE manuscript.people
SET auth_user_id = NULL
WHERE journal_id = '99000000-0000-0000-0000-000000000001';

DELETE FROM manuscript.people
WHERE journal_id = '99000000-0000-0000-0000-000000000001';

DELETE FROM manuscript.journals
WHERE id = '99000000-0000-0000-0000-000000000001';

-- Remove TEST auth accounts and users
DELETE FROM public.account WHERE "userId" LIKE 'test-u-%';
DELETE FROM public."user"  WHERE id        LIKE 'test-u-%';

-- =============================================================================
-- 1. Auth users
-- All passwords are Better Auth scrypt("password"):
--   format: hexSalt:hexKey  (N=16384, r=16, p=1, dkLen=64)
--   hash:   7465737473616c747465737473616c74:c1b7abfd3c6f20b68e6647973b50ece123c823d092277b24c5fffc3e17ccc4282cd1b8bacfe18e1be99c92265cb8e7b79318f4bfa8dd00a39648eb621045b033
-- =============================================================================

INSERT INTO public."user"
    (id, name, email, "emailVerified", "createdAt", "updatedAt", system_admin)
VALUES
    ('test-u-eic',      'Dr. Test EIC',            'eic@test.example.com',       true, now(), now(), false),
    ('test-u-editor',   'Dr. Test Editor',          'editor@test.example.com',    true, now(), now(), false),
    ('test-u-ae',       'Test AE',                  'ae@test.example.com',        true, now(), now(), false),
    ('test-u-support',  'Test Support',             'support@test.example.com',   true, now(), now(), false),
    ('test-u-rev1',     'Dr. Test Reviewer One',    'reviewer1@test.example.com', true, now(), now(), false),
    ('test-u-rev2',     'Dr. Test Reviewer Two',    'reviewer2@test.example.com', true, now(), now(), false),
    ('test-u-rev3',     'Dr. Test Reviewer Three',  'reviewer3@test.example.com', true, now(), now(), false),
    ('test-u-author1',  'Dr. Test Author One',      'author1@test.example.com',   true, now(), now(), false),
    ('test-u-author2',  'Dr. Test Author Two',      'author2@test.example.com',   true, now(), now(), false),
    ('test-u-author3',  'Dr. Test Author Three',    'author3@test.example.com',   true, now(), now(), false);

INSERT INTO public.account
    (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
VALUES
    ('test-a-eic',     'test-u-eic',     'credential', 'test-u-eic',     '7465737473616c747465737473616c74:c1b7abfd3c6f20b68e6647973b50ece123c823d092277b24c5fffc3e17ccc4282cd1b8bacfe18e1be99c92265cb8e7b79318f4bfa8dd00a39648eb621045b033', now(), now()),
    ('test-a-editor',  'test-u-editor',  'credential', 'test-u-editor',  '7465737473616c747465737473616c74:c1b7abfd3c6f20b68e6647973b50ece123c823d092277b24c5fffc3e17ccc4282cd1b8bacfe18e1be99c92265cb8e7b79318f4bfa8dd00a39648eb621045b033', now(), now()),
    ('test-a-ae',      'test-u-ae',      'credential', 'test-u-ae',      '7465737473616c747465737473616c74:c1b7abfd3c6f20b68e6647973b50ece123c823d092277b24c5fffc3e17ccc4282cd1b8bacfe18e1be99c92265cb8e7b79318f4bfa8dd00a39648eb621045b033', now(), now()),
    ('test-a-support', 'test-u-support', 'credential', 'test-u-support', '7465737473616c747465737473616c74:c1b7abfd3c6f20b68e6647973b50ece123c823d092277b24c5fffc3e17ccc4282cd1b8bacfe18e1be99c92265cb8e7b79318f4bfa8dd00a39648eb621045b033', now(), now()),
    ('test-a-rev1',    'test-u-rev1',    'credential', 'test-u-rev1',    '7465737473616c747465737473616c74:c1b7abfd3c6f20b68e6647973b50ece123c823d092277b24c5fffc3e17ccc4282cd1b8bacfe18e1be99c92265cb8e7b79318f4bfa8dd00a39648eb621045b033', now(), now()),
    ('test-a-rev2',    'test-u-rev2',    'credential', 'test-u-rev2',    '7465737473616c747465737473616c74:c1b7abfd3c6f20b68e6647973b50ece123c823d092277b24c5fffc3e17ccc4282cd1b8bacfe18e1be99c92265cb8e7b79318f4bfa8dd00a39648eb621045b033', now(), now()),
    ('test-a-rev3',    'test-u-rev3',    'credential', 'test-u-rev3',    '7465737473616c747465737473616c74:c1b7abfd3c6f20b68e6647973b50ece123c823d092277b24c5fffc3e17ccc4282cd1b8bacfe18e1be99c92265cb8e7b79318f4bfa8dd00a39648eb621045b033', now(), now()),
    ('test-a-author1', 'test-u-author1', 'credential', 'test-u-author1', '7465737473616c747465737473616c74:c1b7abfd3c6f20b68e6647973b50ece123c823d092277b24c5fffc3e17ccc4282cd1b8bacfe18e1be99c92265cb8e7b79318f4bfa8dd00a39648eb621045b033', now(), now()),
    ('test-a-author2', 'test-u-author2', 'credential', 'test-u-author2', '7465737473616c747465737473616c74:c1b7abfd3c6f20b68e6647973b50ece123c823d092277b24c5fffc3e17ccc4282cd1b8bacfe18e1be99c92265cb8e7b79318f4bfa8dd00a39648eb621045b033', now(), now()),
    ('test-a-author3', 'test-u-author3', 'credential', 'test-u-author3', '7465737473616c747465737473616c74:c1b7abfd3c6f20b68e6647973b50ece123c823d092277b24c5fffc3e17ccc4282cd1b8bacfe18e1be99c92265cb8e7b79318f4bfa8dd00a39648eb621045b033', now(), now());

-- =============================================================================
-- 2. Journal
-- =============================================================================

INSERT INTO manuscript.journals (id, name, acronym, issn, subject_area) VALUES
    ('99000000-0000-0000-0000-000000000001',
     'Journal for Testing AgenticES',
     'TEST',
     '0000-0000',
     'Multidisciplinary');

-- =============================================================================
-- 3. People (linked to auth users)
-- =============================================================================

INSERT INTO manuscript.people
    (id, journal_id, email, full_name, orcid, auth_user_id)
VALUES
    ('99000000-0000-0000-0001-000000000001', '99000000-0000-0000-0000-000000000001',
     'eic@test.example.com',       'Dr. Test EIC',           '0000-0099-0001-0001', 'test-u-eic'),

    ('99000000-0000-0000-0001-000000000002', '99000000-0000-0000-0000-000000000001',
     'editor@test.example.com',    'Dr. Test Editor',        '0000-0099-0001-0002', 'test-u-editor'),

    ('99000000-0000-0000-0001-000000000003', '99000000-0000-0000-0000-000000000001',
     'ae@test.example.com',        'Test AE',                NULL,                  'test-u-ae'),

    ('99000000-0000-0000-0001-000000000004', '99000000-0000-0000-0000-000000000001',
     'support@test.example.com',   'Test Support',           NULL,                  'test-u-support'),

    ('99000000-0000-0000-0001-000000000005', '99000000-0000-0000-0000-000000000001',
     'reviewer1@test.example.com', 'Dr. Test Reviewer One',  '0000-0099-0001-0005', 'test-u-rev1'),

    ('99000000-0000-0000-0001-000000000006', '99000000-0000-0000-0000-000000000001',
     'reviewer2@test.example.com', 'Dr. Test Reviewer Two',  '0000-0099-0001-0006', 'test-u-rev2'),

    ('99000000-0000-0000-0001-000000000007', '99000000-0000-0000-0000-000000000001',
     'reviewer3@test.example.com', 'Dr. Test Reviewer Three','0000-0099-0001-0007', 'test-u-rev3'),

    ('99000000-0000-0000-0001-000000000008', '99000000-0000-0000-0000-000000000001',
     'author1@test.example.com',   'Dr. Test Author One',    '0000-0099-0001-0008', 'test-u-author1'),

    ('99000000-0000-0000-0001-000000000009', '99000000-0000-0000-0000-000000000001',
     'author2@test.example.com',   'Dr. Test Author Two',    '0000-0099-0001-0009', 'test-u-author2'),

    ('99000000-0000-0000-0001-000000000010', '99000000-0000-0000-0000-000000000001',
     'author3@test.example.com',   'Dr. Test Author Three',  '0000-0099-0001-0010', 'test-u-author3');

-- =============================================================================
-- 4. Person roles
-- =============================================================================

INSERT INTO manuscript.person_roles (person_id, journal_id, role) VALUES
    ('99000000-0000-0000-0001-000000000001', '99000000-0000-0000-0000-000000000001', 'editor_in_chief'),
    ('99000000-0000-0000-0001-000000000002', '99000000-0000-0000-0000-000000000001', 'editor'),
    ('99000000-0000-0000-0001-000000000003', '99000000-0000-0000-0000-000000000001', 'assistant_editor'),
    ('99000000-0000-0000-0001-000000000004', '99000000-0000-0000-0000-000000000001', 'editorial_support'),
    ('99000000-0000-0000-0001-000000000005', '99000000-0000-0000-0000-000000000001', 'reviewer'),
    ('99000000-0000-0000-0001-000000000006', '99000000-0000-0000-0000-000000000001', 'reviewer'),
    ('99000000-0000-0000-0001-000000000007', '99000000-0000-0000-0000-000000000001', 'reviewer'),
    ('99000000-0000-0000-0001-000000000008', '99000000-0000-0000-0000-000000000001', 'author'),
    ('99000000-0000-0000-0001-000000000009', '99000000-0000-0000-0000-000000000001', 'author'),
    ('99000000-0000-0000-0001-000000000010', '99000000-0000-0000-0000-000000000001', 'author');

-- =============================================================================
-- 5. Manuscript types
-- =============================================================================

INSERT INTO manuscript.manuscript_types
    (id, journal_id, name, acronym, description, display_order)
VALUES
    ('99000000-0000-0000-0003-000000000001', '99000000-0000-0000-0000-000000000001',
     'Original Research', 'OR',
     'Full-length primary research reporting new findings.', 1),

    ('99000000-0000-0000-0003-000000000002', '99000000-0000-0000-0000-000000000001',
     'Review Article', 'REV',
     'Comprehensive synthesis of existing literature.', 2),

    ('99000000-0000-0000-0003-000000000003', '99000000-0000-0000-0000-000000000001',
     'Case Report', 'CR',
     'Description and analysis of a single case or event.', 3);

-- =============================================================================
-- 6. Manuscripts
-- =============================================================================

INSERT INTO manuscript.manuscripts
    (id, journal_id, title, abstract, subject_area, manuscript_type, status,
     submitted_by, submitted_at)
VALUES
    -- MS-1: submitted, no checklist yet
    ('99000000-0000-0000-0002-000000000001',
     '99000000-0000-0000-0000-000000000001',
     'Graph-Based Scheduling of Distributed Editorial Pipelines',
     'We present a graph-based framework for scheduling editorial tasks across distributed teams. Using directed acyclic graphs to represent task dependencies, we demonstrate a 40% reduction in turnaround time compared to sequential assignment models.',
     'Computer Science',
     'Original Research',
     'submitted',
     '99000000-0000-0000-0001-000000000008',
     now() - INTERVAL '7 days'),

    -- MS-2: submitted, checklist passed
    ('99000000-0000-0000-0002-000000000002',
     '99000000-0000-0000-0000-000000000001',
     'Open Data Mandates and Reproducibility in Social Science Research',
     'This article examines the effect of open data mandates on reproducibility rates in high-impact social science journals between 2018 and 2024, using a difference-in-differences design across 14 journals.',
     'Social Science',
     'Review Article',
     'submitted',
     '99000000-0000-0000-0001-000000000009',
     now() - INTERVAL '10 days'),

    -- MS-3: submitted, checklist needs human review
    ('99000000-0000-0000-0002-000000000003',
     '99000000-0000-0000-0000-000000000001',
     'Case Study: Implementation of AI-Assisted Peer Review at a Regional Medical Journal',
     'We describe the 18-month implementation of an AI-assisted peer-review system at a regional medical journal, reporting on checklist pass rates, editorial staff time savings, and reviewer satisfaction.',
     'Medical Informatics',
     'Case Report',
     'submitted',
     '99000000-0000-0000-0001-000000000008',
     now() - INTERVAL '5 days'),

    -- MS-4: under_review, reviewers invited, no responses (stalled — last event 20d ago)
    ('99000000-0000-0000-0002-000000000004',
     '99000000-0000-0000-0000-000000000001',
     'Reinforcement Learning for Dynamic Resource Allocation in Cloud Editorial Systems',
     'We propose a reinforcement learning agent that dynamically allocates reviewer resources based on manuscript complexity, submission volume, and historical turnaround metrics.',
     'Machine Learning',
     'Original Research',
     'under_review',
     '99000000-0000-0000-0001-000000000009',
     now() - INTERVAL '35 days'),

    -- MS-5: under_review, 2 of 3 reviews submitted (stalled — last review 20d ago)
    ('99000000-0000-0000-0002-000000000005',
     '99000000-0000-0000-0000-000000000001',
     'Automated Conflict-of-Interest Detection in Academic Publishing Using Graph Neural Networks',
     'We introduce CoINet, a graph neural network that detects potential conflicts of interest between authors and reviewers by traversing co-authorship, institutional affiliation, and citation graphs.',
     'Computer Science',
     'Original Research',
     'under_review',
     '99000000-0000-0000-0001-000000000008',
     now() - INTERVAL '55 days'),

    -- MS-6: revision_requested
    ('99000000-0000-0000-0002-000000000006',
     '99000000-0000-0000-0000-000000000001',
     'Meta-Analysis of Double-Blind vs. Single-Blind Peer Review Outcomes Across STEM Disciplines',
     'A meta-analysis of 47 studies (n = 18,204 manuscripts) comparing acceptance rates, review quality, and gender bias across double-blind and single-blind peer review systems in STEM journals.',
     'Science Policy',
     'Review Article',
     'revision_requested',
     '99000000-0000-0000-0001-000000000009',
     now() - INTERVAL '75 days'),

    -- MS-7: accepted
    ('99000000-0000-0000-0002-000000000007',
     '99000000-0000-0000-0000-000000000001',
     'Predicting Reviewer Acceptance Rates Using Submission Metadata: A Retrospective Cohort Study',
     'Using 6 years of submission and reviewer response data from three journals, we train a gradient boosted model that predicts reviewer acceptance probability with 78% AUC, enabling more efficient invitation targeting.',
     'Bibliometrics',
     'Original Research',
     'accepted',
     '99000000-0000-0000-0001-000000000010',
     now() - INTERVAL '120 days'),

    -- MS-8: rejected
    ('99000000-0000-0000-0002-000000000008',
     '99000000-0000-0000-0000-000000000001',
     'Blockchain Ledgers for Peer Review Transparency: A Pilot Study',
     'We report a six-month pilot of a permissioned blockchain ledger for recording peer review events at two humanities journals, assessing auditability, performance, and editorial staff acceptance.',
     'Information Systems',
     'Case Report',
     'rejected',
     '99000000-0000-0000-0001-000000000010',
     now() - INTERVAL '140 days');

-- =============================================================================
-- 7. Manuscript authors (corresponding author for each manuscript + co-authors)
-- =============================================================================

-- Corresponding authors (all manuscripts)
INSERT INTO manuscript.manuscript_authors
    (manuscript_id, person_id, is_corresponding, display_order)
VALUES
    ('99000000-0000-0000-0002-000000000001', '99000000-0000-0000-0001-000000000008', true,  0),
    ('99000000-0000-0000-0002-000000000002', '99000000-0000-0000-0001-000000000009', true,  0),
    ('99000000-0000-0000-0002-000000000003', '99000000-0000-0000-0001-000000000008', true,  0),
    ('99000000-0000-0000-0002-000000000004', '99000000-0000-0000-0001-000000000009', true,  0),
    ('99000000-0000-0000-0002-000000000005', '99000000-0000-0000-0001-000000000008', true,  0),
    ('99000000-0000-0000-0002-000000000006', '99000000-0000-0000-0001-000000000009', true,  0),
    ('99000000-0000-0000-0002-000000000007', '99000000-0000-0000-0001-000000000010', true,  0),
    ('99000000-0000-0000-0002-000000000008', '99000000-0000-0000-0001-000000000010', true,  0);

-- Co-authors (MS-5 has two co-authors to exercise the author list UI)
INSERT INTO manuscript.manuscript_authors
    (manuscript_id, person_id, is_corresponding, display_order)
VALUES
    ('99000000-0000-0000-0002-000000000005', '99000000-0000-0000-0001-000000000009', false, 1),
    ('99000000-0000-0000-0002-000000000005', '99000000-0000-0000-0001-000000000010', false, 2);

-- =============================================================================
-- 8. Reviewer assignments
-- =============================================================================

-- MS-4: 3 reviewers invited, none responded
INSERT INTO manuscript.assignments
    (manuscript_id, person_id, role, invitation_status, due_at, assigned_at)
VALUES
    ('99000000-0000-0000-0002-000000000004', '99000000-0000-0000-0001-000000000005',
     'reviewer', 'invited', now() + INTERVAL '7 days',  now() - INTERVAL '20 days'),
    ('99000000-0000-0000-0002-000000000004', '99000000-0000-0000-0001-000000000006',
     'reviewer', 'invited', now() + INTERVAL '7 days',  now() - INTERVAL '20 days'),
    ('99000000-0000-0000-0002-000000000004', '99000000-0000-0000-0001-000000000007',
     'reviewer', 'invited', now() + INTERVAL '7 days',  now() - INTERVAL '20 days');

-- MS-5: 2 completed, 1 still invited
INSERT INTO manuscript.assignments
    (manuscript_id, person_id, role, invitation_status, due_at, assigned_at)
VALUES
    ('99000000-0000-0000-0002-000000000005', '99000000-0000-0000-0001-000000000005',
     'reviewer', 'completed', now() - INTERVAL '20 days', now() - INTERVAL '45 days'),
    ('99000000-0000-0000-0002-000000000005', '99000000-0000-0000-0001-000000000006',
     'reviewer', 'completed', now() - INTERVAL '20 days', now() - INTERVAL '45 days'),
    ('99000000-0000-0000-0002-000000000005', '99000000-0000-0000-0001-000000000007',
     'reviewer', 'invited',   now() + INTERVAL '7 days',  now() - INTERVAL '40 days');

-- MS-6: 2 completed (led to decision)
INSERT INTO manuscript.assignments
    (manuscript_id, person_id, role, invitation_status, due_at, assigned_at)
VALUES
    ('99000000-0000-0000-0002-000000000006', '99000000-0000-0000-0001-000000000005',
     'reviewer', 'completed', now() - INTERVAL '40 days', now() - INTERVAL '65 days'),
    ('99000000-0000-0000-0002-000000000006', '99000000-0000-0000-0001-000000000006',
     'reviewer', 'completed', now() - INTERVAL '40 days', now() - INTERVAL '65 days');

-- MS-7: 3 completed (accepted)
INSERT INTO manuscript.assignments
    (manuscript_id, person_id, role, invitation_status, due_at, assigned_at)
VALUES
    ('99000000-0000-0000-0002-000000000007', '99000000-0000-0000-0001-000000000005',
     'reviewer', 'completed', now() - INTERVAL '85 days', now() - INTERVAL '110 days'),
    ('99000000-0000-0000-0002-000000000007', '99000000-0000-0000-0001-000000000006',
     'reviewer', 'completed', now() - INTERVAL '85 days', now() - INTERVAL '110 days'),
    ('99000000-0000-0000-0002-000000000007', '99000000-0000-0000-0001-000000000007',
     'reviewer', 'completed', now() - INTERVAL '85 days', now() - INTERVAL '110 days');

-- MS-8: 2 completed (rejected)
INSERT INTO manuscript.assignments
    (manuscript_id, person_id, role, invitation_status, due_at, assigned_at)
VALUES
    ('99000000-0000-0000-0002-000000000008', '99000000-0000-0000-0001-000000000005',
     'reviewer', 'completed', now() - INTERVAL '110 days', now() - INTERVAL '130 days'),
    ('99000000-0000-0000-0002-000000000008', '99000000-0000-0000-0001-000000000006',
     'reviewer', 'completed', now() - INTERVAL '110 days', now() - INTERVAL '130 days');

-- =============================================================================
-- 9. History events — full audit trail per manuscript
-- =============================================================================

INSERT INTO history.events
    (journal_id, manuscript_id, event_type, actor_id, actor_type, payload, occurred_at)
VALUES

-- ── MS-1: submitted only ──────────────────────────────────────────────────
('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000001',
 'manuscript.submitted', '99000000-0000-0000-0001-000000000008', 'person',
 '{"type":"Original Research"}',
 now() - INTERVAL '7 days'),

-- ── MS-2: submitted → checklist pass ─────────────────────────────────────
('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000002',
 'manuscript.submitted', '99000000-0000-0000-0001-000000000009', 'person',
 '{"type":"Review Article"}',
 now() - INTERVAL '10 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000002',
 'checklist.evaluated', NULL, 'agent',
 '{"overall":"pass","summary":"All checklist items satisfied. Ethics statement present, data availability confirmed, authorship complete.","items":[{"key":"ethics_statement","status":"pass","confidence":0.97,"note":"Ethics statement found in section 5."},{"key":"data_availability","status":"pass","confidence":0.94,"note":"Data deposited at Zenodo DOI 10.5281/zenodo.9999999."},{"key":"authorship_complete","status":"pass","confidence":0.99,"note":"All author contributions declared."},{"key":"conflict_of_interest","status":"pass","confidence":0.95,"note":"No conflicts declared."}]}',
 now() - INTERVAL '9 days'),

-- ── MS-3: submitted → checklist needs human review ───────────────────────
('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000003',
 'manuscript.submitted', '99000000-0000-0000-0001-000000000008', 'person',
 '{"type":"Case Report"}',
 now() - INTERVAL '5 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000003',
 'checklist.evaluated', NULL, 'agent',
 '{"overall":"needs_human_review","summary":"Ethics statement is ambiguous — the manuscript describes patient data collection but the referenced ethics approval number could not be verified. Human review required.","items":[{"key":"ethics_statement","status":"needs_review","confidence":0.51,"note":"Ethics approval referenced (REC-2024-0012) but could not be cross-checked."},{"key":"data_availability","status":"pass","confidence":0.92,"note":"Clinical data availability statement present."},{"key":"authorship_complete","status":"pass","confidence":0.99,"note":"Three authors, all contributions declared."},{"key":"conflict_of_interest","status":"pass","confidence":0.96,"note":"No conflicts declared."}]}',
 now() - INTERVAL '4 days'),

-- ── MS-4: submitted → checklist → under_review → reviewers invited (stalled) ──
('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000004',
 'manuscript.submitted', '99000000-0000-0000-0001-000000000009', 'person',
 '{"type":"Original Research"}',
 now() - INTERVAL '35 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000004',
 'checklist.evaluated', NULL, 'agent',
 '{"overall":"pass","summary":"All items pass.","items":[{"key":"ethics_statement","status":"pass","confidence":0.98,"note":"IRB waiver for ML study confirmed."},{"key":"data_availability","status":"pass","confidence":0.95,"note":"Code repository linked."}]}',
 now() - INTERVAL '34 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000004',
 'checklist.passed', '99000000-0000-0000-0001-000000000003', 'person',
 '{"action":"pass_to_eic"}',
 now() - INTERVAL '32 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000004',
 'reviewer.invited', '99000000-0000-0000-0001-000000000003', 'person',
 '{"invited_person_id":"99000000-0000-0000-0001-000000000005","reviewer_name":"Dr. Test Reviewer One"}',
 now() - INTERVAL '20 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000004',
 'reviewer.invited', '99000000-0000-0000-0001-000000000003', 'person',
 '{"invited_person_id":"99000000-0000-0000-0001-000000000006","reviewer_name":"Dr. Test Reviewer Two"}',
 now() - INTERVAL '20 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000004',
 'reviewer.invited', '99000000-0000-0000-0001-000000000003', 'person',
 '{"invited_person_id":"99000000-0000-0000-0001-000000000007","reviewer_name":"Dr. Test Reviewer Three"}',
 now() - INTERVAL '20 days'),

-- ── MS-5: submitted → checklist → under_review → 2/3 reviews in (stalled) ─
('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000005',
 'manuscript.submitted', '99000000-0000-0000-0001-000000000008', 'person',
 '{"type":"Original Research"}',
 now() - INTERVAL '55 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000005',
 'checklist.evaluated', NULL, 'agent',
 '{"overall":"pass","summary":"All items pass.","items":[{"key":"ethics_statement","status":"pass","confidence":0.97,"note":"Algorithm study — no human subjects."},{"key":"data_availability","status":"pass","confidence":0.98,"note":"Training data and code on GitHub."}]}',
 now() - INTERVAL '54 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000005',
 'checklist.passed', '99000000-0000-0000-0001-000000000003', 'person',
 '{"action":"pass_to_eic"}',
 now() - INTERVAL '52 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000005',
 'reviewer.invited', '99000000-0000-0000-0001-000000000003', 'person',
 '{"invited_person_id":"99000000-0000-0000-0001-000000000005","reviewer_name":"Dr. Test Reviewer One"}',
 now() - INTERVAL '45 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000005',
 'reviewer.invited', '99000000-0000-0000-0001-000000000003', 'person',
 '{"invited_person_id":"99000000-0000-0000-0001-000000000006","reviewer_name":"Dr. Test Reviewer Two"}',
 now() - INTERVAL '45 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000005',
 'reviewer.invited', '99000000-0000-0000-0001-000000000003', 'person',
 '{"invited_person_id":"99000000-0000-0000-0001-000000000007","reviewer_name":"Dr. Test Reviewer Three"}',
 now() - INTERVAL '45 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000005',
 'reviewer.accepted', '99000000-0000-0000-0001-000000000005', 'person',
 '{"reviewer_name":"Dr. Test Reviewer One"}',
 now() - INTERVAL '43 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000005',
 'reviewer.accepted', '99000000-0000-0000-0001-000000000006', 'person',
 '{"reviewer_name":"Dr. Test Reviewer Two"}',
 now() - INTERVAL '42 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000005',
 'review.submitted', '99000000-0000-0000-0001-000000000005', 'person',
 '{"reviewer_name":"Dr. Test Reviewer One","recommendation":"minor_revision","summary":"Solid methodology. The conflict graph construction is sound and results are well-presented. Suggest expanding the discussion of computational complexity for large graphs.","comments_author":"Please provide a complexity analysis for graphs exceeding 100k nodes, and address scalability in the limitations section."}',
 now() - INTERVAL '22 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000005',
 'review.submitted', '99000000-0000-0000-0001-000000000006', 'person',
 '{"reviewer_name":"Dr. Test Reviewer Two","recommendation":"accept","summary":"Excellent work. The CoINet approach is novel and the evaluation thorough. Ready for publication with only minor editorial corrections.","comments_author":"Minor: fix typographic errors in Table 2. Figure 3 labels are too small for print."}',
 now() - INTERVAL '20 days'),

-- ── MS-6: submitted → checklist → reviews → major revision ───────────────
('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000006',
 'manuscript.submitted', '99000000-0000-0000-0001-000000000009', 'person',
 '{"type":"Review Article"}',
 now() - INTERVAL '75 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000006',
 'checklist.evaluated', NULL, 'agent',
 '{"overall":"pass","summary":"All items satisfied.","items":[{"key":"ethics_statement","status":"pass","confidence":0.99,"note":"Secondary data analysis — no ethics approval required."},{"key":"data_availability","status":"pass","confidence":0.97,"note":"All 47 source studies cited and available."}]}',
 now() - INTERVAL '74 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000006',
 'checklist.passed', '99000000-0000-0000-0001-000000000003', 'person',
 '{"action":"pass_to_eic"}',
 now() - INTERVAL '72 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000006',
 'reviewer.invited', '99000000-0000-0000-0001-000000000002', 'person',
 '{"invited_person_id":"99000000-0000-0000-0001-000000000005","reviewer_name":"Dr. Test Reviewer One"}',
 now() - INTERVAL '65 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000006',
 'reviewer.invited', '99000000-0000-0000-0001-000000000002', 'person',
 '{"invited_person_id":"99000000-0000-0000-0001-000000000006","reviewer_name":"Dr. Test Reviewer Two"}',
 now() - INTERVAL '65 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000006',
 'review.submitted', '99000000-0000-0000-0001-000000000005', 'person',
 '{"reviewer_name":"Dr. Test Reviewer One","recommendation":"major_revision","summary":"The meta-analysis covers an important topic but has significant methodological gaps. The heterogeneity assessment is incomplete, and three key studies from 2023 are not included.","comments_author":"1. Include Smithson et al. (2023), Lee & Park (2023), and Okafor et al. (2023). 2. Conduct I² analysis for each outcome. 3. Clarify inclusion/exclusion criteria for grey literature."}',
 now() - INTERVAL '48 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000006',
 'review.submitted', '99000000-0000-0000-0001-000000000006', 'person',
 '{"reviewer_name":"Dr. Test Reviewer Two","recommendation":"major_revision","summary":"Important topic but requires substantial revision. The statistical synthesis of heterogeneous effect sizes is problematic and must be addressed before this can be accepted.","comments_author":"The random-effects model pooling needs justification. Consider Bayesian meta-analysis to better handle the high heterogeneity."}',
 now() - INTERVAL '45 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000006',
 'decision.sent', '99000000-0000-0000-0001-000000000002', 'person',
 '{"decision":"major_revision","letter":"Dear Dr. Test Author Two,\n\nThank you for your submission to the Journal for Testing AgenticES. After careful consideration of the reviewers'' reports, we have decided to invite a major revision of your manuscript.\n\nBoth reviewers identified significant methodological concerns, particularly around the heterogeneity assessment and inclusion of recent studies. Please address all reviewer comments in a point-by-point response letter.\n\nWe look forward to receiving your revised manuscript within 60 days.\n\nBest regards,\nDr. Test Editor\nEditor, Journal for Testing AgenticES"}',
 now() - INTERVAL '40 days'),

-- ── MS-7: submitted → checklist → reviews → accepted ─────────────────────
('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000007',
 'manuscript.submitted', '99000000-0000-0000-0001-000000000010', 'person',
 '{"type":"Original Research"}',
 now() - INTERVAL '120 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000007',
 'checklist.evaluated', NULL, 'agent',
 '{"overall":"pass","summary":"All checklist items pass.","items":[{"key":"ethics_statement","status":"pass","confidence":0.99,"note":"Retrospective data analysis, ethics waiver on file."},{"key":"data_availability","status":"pass","confidence":0.97,"note":"Dataset available under data use agreement."}]}',
 now() - INTERVAL '119 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000007',
 'checklist.passed', '99000000-0000-0000-0001-000000000003', 'person',
 '{"action":"pass_to_eic"}',
 now() - INTERVAL '117 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000007',
 'reviewer.invited', '99000000-0000-0000-0001-000000000002', 'person',
 '{"invited_person_id":"99000000-0000-0000-0001-000000000005","reviewer_name":"Dr. Test Reviewer One"}',
 now() - INTERVAL '110 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000007',
 'reviewer.invited', '99000000-0000-0000-0001-000000000002', 'person',
 '{"invited_person_id":"99000000-0000-0000-0001-000000000006","reviewer_name":"Dr. Test Reviewer Two"}',
 now() - INTERVAL '110 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000007',
 'reviewer.invited', '99000000-0000-0000-0001-000000000002', 'person',
 '{"invited_person_id":"99000000-0000-0000-0001-000000000007","reviewer_name":"Dr. Test Reviewer Three"}',
 now() - INTERVAL '110 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000007',
 'review.submitted', '99000000-0000-0000-0001-000000000005', 'person',
 '{"reviewer_name":"Dr. Test Reviewer One","recommendation":"accept","summary":"Excellent work. The model is well-validated and the retrospective dataset well-described. Findings are important for improving reviewer selection efficiency.","comments_author":"No significant concerns. Minor: update Figure 1 caption to include sample size."}',
 now() - INTERVAL '90 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000007',
 'review.submitted', '99000000-0000-0000-0001-000000000006', 'person',
 '{"reviewer_name":"Dr. Test Reviewer Two","recommendation":"accept","summary":"Strong paper. The 78% AUC is impressive for this task and the feature importance analysis is insightful. Ready for publication.","comments_author":"Suggest adding confidence intervals to Table 3 for the AUC values."}',
 now() - INTERVAL '88 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000007',
 'review.submitted', '99000000-0000-0000-0001-000000000007', 'person',
 '{"reviewer_name":"Dr. Test Reviewer Three","recommendation":"minor_revision","summary":"Good contribution. I have one concern about the train/test split methodology that should be addressed.","comments_author":"Please clarify whether the train/test split was stratified by journal to avoid data leakage."}',
 now() - INTERVAL '85 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000007',
 'decision.sent', '99000000-0000-0000-0001-000000000002', 'person',
 '{"decision":"accept","letter":"Dear Dr. Test Author Three,\n\nWe are delighted to inform you that your manuscript has been accepted for publication in the Journal for Testing AgenticES.\n\nAll three reviewers recommended acceptance, with only minor comments that you have addressed satisfactorily. Congratulations on an excellent contribution.\n\nYou will receive production proofs within 10 business days.\n\nBest regards,\nDr. Test Editor\nEditor, Journal for Testing AgenticES"}',
 now() - INTERVAL '80 days'),

-- ── MS-8: submitted → checklist → reviews → rejected ─────────────────────
('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000008',
 'manuscript.submitted', '99000000-0000-0000-0001-000000000010', 'person',
 '{"type":"Case Report"}',
 now() - INTERVAL '140 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000008',
 'checklist.evaluated', NULL, 'agent',
 '{"overall":"pass","summary":"All items pass.","items":[{"key":"ethics_statement","status":"pass","confidence":0.96,"note":"IRB approval 2024-BC-0017 verified."},{"key":"data_availability","status":"pass","confidence":0.93,"note":"Pilot data shared with editors on request."}]}',
 now() - INTERVAL '139 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000008',
 'checklist.passed', '99000000-0000-0000-0001-000000000003', 'person',
 '{"action":"pass_to_eic"}',
 now() - INTERVAL '137 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000008',
 'reviewer.invited', '99000000-0000-0000-0001-000000000002', 'person',
 '{"invited_person_id":"99000000-0000-0000-0001-000000000005","reviewer_name":"Dr. Test Reviewer One"}',
 now() - INTERVAL '130 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000008',
 'reviewer.invited', '99000000-0000-0000-0001-000000000002', 'person',
 '{"invited_person_id":"99000000-0000-0000-0001-000000000006","reviewer_name":"Dr. Test Reviewer Two"}',
 now() - INTERVAL '130 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000008',
 'review.submitted', '99000000-0000-0000-0001-000000000005', 'person',
 '{"reviewer_name":"Dr. Test Reviewer One","recommendation":"reject","summary":"The blockchain approach is technically sound but the scope is too narrow for a meaningful contribution. A six-month pilot at two humanities journals cannot support the claims made about general applicability in academic publishing.","comments_author":"The study design limits generalisability. Recommend expanding to at least 5 journals across disciplines before resubmission."}',
 now() - INTERVAL '115 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000008',
 'review.submitted', '99000000-0000-0000-0001-000000000006', 'person',
 '{"reviewer_name":"Dr. Test Reviewer Two","recommendation":"reject","summary":"Technically adequate but insufficient novelty. Blockchain for audit trails is well-established in adjacent domains. The academic publishing context does not add sufficient novelty to warrant publication.","comments_author":"Suggest framing as a short technical note if resubmitted, and focusing on the staff acceptance findings which are the more novel contribution."}',
 now() - INTERVAL '112 days'),

('99000000-0000-0000-0000-000000000001', '99000000-0000-0000-0002-000000000008',
 'decision.sent', '99000000-0000-0000-0001-000000000002', 'person',
 '{"decision":"reject","letter":"Dear Dr. Test Author Three,\n\nThank you for your submission to the Journal for Testing AgenticES. After careful consideration of the reviewers'' reports, we regret to inform you that we cannot accept your manuscript for publication.\n\nBoth reviewers raised concerns about the scope and novelty of the contribution. The reviewers'' full comments are enclosed.\n\nWe appreciate your interest in our journal and encourage you to consider resubmission after substantially expanding the scope of the study.\n\nBest regards,\nDr. Test Editor\nEditor, Journal for Testing AgenticES"}',
 now() - INTERVAL '105 days');
