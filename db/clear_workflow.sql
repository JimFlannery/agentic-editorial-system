-- =============================================================================
-- Clear the seeded TEST workflow from the graph
-- =============================================================================
-- Removes the WorkflowDefinition + Step nodes created by db/seed_workflow.sql.
-- Used to verify that the pipeline page falls back to the status enum view
-- when no workflow is defined.
--
-- Run via (bash / WSL / Git Bash):
--   docker exec -i ems-postgres psql -U ems -d ems_db < db/clear_workflow.sql
--
-- Run via (PowerShell — `<` is reserved, use Get-Content):
--   Get-Content db/clear_workflow.sql | docker exec -i ems-postgres psql -U ems -d ems_db
-- =============================================================================

LOAD 'age';
SET search_path = ag_catalog, "$user", public;

SELECT * FROM cypher('ems_graph', $$
    MATCH (n)
    WHERE n.workflow_id = '99000000-0000-0000-0000-00000000a001'
    DETACH DELETE n
$$) AS (v agtype);

-- Verify nothing remains
SELECT * FROM cypher('ems_graph', $$
    MATCH (w:WorkflowDefinition)
    WHERE w.journal_id = '99000000-0000-0000-0000-000000000001'
    RETURN w.name AS name
$$) AS (name agtype);
