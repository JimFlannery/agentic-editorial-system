# Testing Procedures

Manual testing procedures for features that need verification across different system states. Each procedure is self-contained — prerequisites, steps, expected results, and cleanup.

Add new procedures here when a feature has a non-obvious test path that future contributors will need to know about.

---

## Contents

1. [Manuscript Pipeline — graph-driven vs. enum fallback](#1-manuscript-pipeline--graph-driven-vs-enum-fallback)

---

## 1. Manuscript Pipeline — graph-driven vs. enum fallback

The Manuscript Pipeline page at `/journal/[acronym]/editorial/pipeline` reads workflow stages from the property graph when a `WorkflowDefinition` exists for the journal, and falls back to the relational `manuscript.status` enum when none does. This procedure verifies both code paths.

### Why this needs explicit testing

The two paths produce visually similar UIs — the same pipeline strip, the same filterable table, the same counts. The differences are subtle: stage labels, ordering, and whether the "no workflow defined" notice is shown. A regression in either branch is easy to miss without explicitly toggling between modes.

### Prerequisites

- Local development environment running per [docs/deploy/development.md](deploy/development.md)
- The `TEST` journal exists with seeded manuscripts (the default dev seed)
- `ems-postgres` Docker container is running
- Logged in as a user with one of: `editor`, `editor_in_chief`, `editorial_support`, `journal_admin`

### Shell note

All commands below show two variants. **PowerShell** does not support `<` for stdin redirection — that operator is reserved — so on Windows you must pipe via `Get-Content`. **bash / WSL / Git Bash** users can use the `<` form. Pick whichever matches your shell; both produce identical results.

### Step 1 — Verify enum fallback (no workflow in graph)

Ensure no workflow exists in the graph for the TEST journal, then load the page:

```bash
# bash / WSL / Git Bash
docker exec -i ems-postgres psql -U ems -d ems_db < db/clear_workflow.sql
```

```powershell
# PowerShell
Get-Content db/clear_workflow.sql | docker exec -i ems-postgres psql -U ems -d ems_db
```

Navigate to `/journal/TEST/editorial/pipeline`.

**Expected:**
- A dashed-border notice appears above the pipeline strip: *"Showing default statuses — no workflow definition is configured for this journal yet. [Configure a workflow] to drive this view from the graph."*
- Pipeline strip shows the six default stages in this order, using enum-derived labels:
  1. **In Checklist Queue** (label from `ENUM_STAGES`)
  2. **Under Review**
  3. **Awaiting Revision**
  4. **Accepted** *(hidden by default — toggle "Show terminal")*
  5. **Rejected** *(hidden)*
  6. **Withdrawn** *(hidden)*
- Counts are non-zero for stages with seeded manuscripts. Against the default seed: 3 in checklist queue, 2 under review, 1 awaiting revision.

### Step 2 — Verify graph-driven mode

Seed the standard test workflow into the graph:

```bash
# bash / WSL / Git Bash
docker exec -i ems-postgres psql -U ems -d ems_db < db/seed_workflow.sql
```

```powershell
# PowerShell
Get-Content db/seed_workflow.sql | docker exec -i ems-postgres psql -U ems -d ems_db
```

The verification query at the bottom of `seed_workflow.sql` should print all six Step nodes with their `name`, `position`, `status`, and `terminal` properties. If it prints zero rows, the seed failed — investigate before continuing.

Refresh the pipeline page (no app restart needed).

**Expected:**
- The dashed-border notice is **gone**.
- Pipeline strip shows the same stages, but with **graph-derived labels** from the seed file's Step nodes. With the current seed these are identical to the enum labels because the seed deliberately mirrors them — see [Step 4](#step-4--prove-the-graph-is-actually-the-source) below for a stronger test.
- Counts are unchanged (the count source is `m.status` for both modes).
- Stage order matches the `position` properties on the Step nodes (10, 20, 30, 40, 50, 60).

### Step 3 — Verify the URL-driven filters

With the workflow seeded, exercise each interactive control. None of them should require client-side JavaScript — every state change is a navigation.

| Action | Expected URL | Expected behaviour |
|---|---|---|
| Click the "Under Review" tile | `?stage=under_review` | Tile gains a darker border and `aria-pressed="true"`; table below filters to that stage only |
| Click the same tile again | `/.../pipeline` (no params) | Filter clears; table shows all active manuscripts |
| Type in search box, press Enter | `?q=...` | Form submits as GET; results filter by title or tracking number `ILIKE` |
| Click "Show terminal" | `?include_terminal=1` | Terminal stage tiles appear in the strip; table starts including accepted/rejected/withdrawn |
| Combine filters (search + stage + show terminal) | All three params present | Each filter additive; "Clear stage filter" link removes only the stage filter |

Tab through the page using only the keyboard. Every tile and link must be reachable, and the active filter must be announced via `aria-pressed`. Focus rings must be visible.

### Step 4 — Prove the graph is actually the source

This is the test that catches a regression where the page silently uses the enum even when the graph is populated. Modify one Step node's name in `db/seed_workflow.sql` to something obviously different, e.g. change `'In Checklist Queue'` on line ~41 to `'GRAPH-DRIVEN: Initial Triage'`. Re-run the seed:

```bash
docker exec -i ems-postgres psql -U ems -d ems_db < db/seed_workflow.sql
```

Refresh the page.

Re-run with the appropriate command for your shell:

```bash
# bash / WSL / Git Bash
docker exec -i ems-postgres psql -U ems -d ems_db < db/seed_workflow.sql
```

```powershell
# PowerShell
Get-Content db/seed_workflow.sql | docker exec -i ems-postgres psql -U ems -d ems_db
```

**Expected:** The first tile in the pipeline strip now reads **"GRAPH-DRIVEN: Initial Triage"**. If it still says "In Checklist Queue", the page is reading from the enum fallback when it should be reading from the graph — `getGraphStages()` in [app/journal/[acronym]/editorial/pipeline/page.tsx](../app/journal/[acronym]/editorial/pipeline/page.tsx) is broken.

**Revert** the seed file change and re-run `db/seed_workflow.sql` once you're done so the test journal returns to its documented state.

### Step 5 — Cleanup

Restore the test journal to a known state. Either leave it graph-driven (recommended for ongoing development) by re-running `db/seed_workflow.sql`, or clear the workflow if you specifically want to test on the enum path with `db/clear_workflow.sql`. Use the shell-appropriate invocation from the [Shell note](#shell-note) above.

### Files involved

- [app/journal/[acronym]/editorial/pipeline/page.tsx](../app/journal/[acronym]/editorial/pipeline/page.tsx) — page implementation (`getPipelineStages`, `getGraphStages`, `ENUM_STAGES`)
- [db/seed_workflow.sql](../db/seed_workflow.sql) — idempotent workflow seed (creates 6 Step nodes for TEST journal)
- [db/clear_workflow.sql](../db/clear_workflow.sql) — removes the seeded workflow

### Notes

- Both seed and clear scripts are idempotent and safe to re-run.
- The seed tags every node with `workflow_id` so cleanup is a single `DETACH DELETE` — this avoids AGE's lack of multi-relationship-type matching (see CLAUDE.md "Apache AGE Cypher Limitations").
- The seed and clear scripts only affect the TEST journal (`99000000-0000-0000-0000-000000000001`). Running them against a production database with real workflows is a no-op for any other journal, but always verify the `journal_id` constants if you adapt the scripts for another environment.
