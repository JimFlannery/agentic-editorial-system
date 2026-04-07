-- =============================================================================
-- Seed: Standard Editorial Workflow for the TEST journal
-- =============================================================================
-- Creates a graph-driven workflow that the pipeline page (and any other
-- graph-aware view) can read. Idempotent — re-running deletes the previous
-- version of this workflow first, then recreates it.
--
-- The workflow models the high-level lifecycle as a chain of Step nodes.
-- Each Step carries a `status` property mapping it to the manuscript.status
-- enum, and a `terminal` boolean flag. This is what the pipeline page reads
-- via getGraphStages() in app/journal/[acronym]/editorial/pipeline/page.tsx.
--
-- Run via (bash / WSL / Git Bash):
--   docker exec -i ems-postgres psql -U ems -d ems_db < db/seed_workflow.sql
--
-- Run via (PowerShell — `<` is reserved, use Get-Content):
--   Get-Content db/seed_workflow.sql | docker exec -i ems-postgres psql -U ems -d ems_db
-- =============================================================================

LOAD 'age';
SET search_path = ag_catalog, "$user", public;

-- Step 1: delete any prior version of this workflow's nodes (idempotent).
-- We tag every node owned by this workflow with workflow_id so cleanup is
-- a single DETACH DELETE without needing to traverse relationships.
SELECT * FROM cypher('ems_graph', $$
    MATCH (n)
    WHERE n.workflow_id = '99000000-0000-0000-0000-00000000a001'
    DETACH DELETE n
$$) AS (v agtype);

-- Step 2: create the WorkflowDefinition + Step nodes in a single CREATE,
-- then wire FIRST_STEP and NEXT relationships in the same statement.
SELECT * FROM cypher('ems_graph', $$
    CREATE
      (w:WorkflowDefinition {
        id:              '99000000-0000-0000-0000-00000000a001',
        workflow_id:     '99000000-0000-0000-0000-00000000a001',
        journal_id:      '99000000-0000-0000-0000-000000000001',
        manuscript_type: 'Original Research',
        name:            'Standard Editorial Workflow',
        description:     'Default end-to-end workflow for original research articles'
      }),
      (s1:Step {
        workflow_id: '99000000-0000-0000-0000-00000000a001',
        name:        'In Checklist Queue',
        position:    10,
        status:      'submitted',
        terminal:    false,
        step_type:   'intake'
      }),
      (s2:Step {
        workflow_id: '99000000-0000-0000-0000-00000000a001',
        name:        'Under Peer Review',
        position:    20,
        status:      'under_review',
        terminal:    false,
        step_type:   'review'
      }),
      (s3:Step {
        workflow_id: '99000000-0000-0000-0000-00000000a001',
        name:        'Awaiting Revision',
        position:    30,
        status:      'revision_requested',
        terminal:    false,
        step_type:   'author_action'
      }),
      (s4:Step {
        workflow_id: '99000000-0000-0000-0000-00000000a001',
        name:        'Accepted',
        position:    40,
        status:      'accepted',
        terminal:    true,
        step_type:   'terminal'
      }),
      (s5:Step {
        workflow_id: '99000000-0000-0000-0000-00000000a001',
        name:        'Rejected',
        position:    50,
        status:      'rejected',
        terminal:    true,
        step_type:   'terminal'
      }),
      (s6:Step {
        workflow_id: '99000000-0000-0000-0000-00000000a001',
        name:        'Withdrawn',
        position:    60,
        status:      'withdrawn',
        terminal:    true,
        step_type:   'terminal'
      }),
      (w)-[:FIRST_STEP]->(s1),
      (s1)-[:NEXT]->(s2),
      (s2)-[:NEXT]->(s3),
      (s3)-[:NEXT]->(s4),
      (s4)-[:NEXT]->(s5),
      (s5)-[:NEXT]->(s6)
$$) AS (v agtype);

-- Verification: list the stages we just created
SELECT * FROM cypher('ems_graph', $$
    MATCH (w:WorkflowDefinition)-[:FIRST_STEP]->(first)
    WHERE w.journal_id = '99000000-0000-0000-0000-000000000001'
    MATCH (first)-[:NEXT*0..10]->(node)
    RETURN node.name AS name,
           node.position AS position,
           node.status AS status,
           node.terminal AS terminal
$$) AS (name agtype, position agtype, status agtype, terminal agtype);
