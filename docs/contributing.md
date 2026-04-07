# Contributing

Contributions are welcome. This project is licensed under AGPLv3 — by contributing you agree that your contributions will be licensed under the same terms.

---

## Contents

1. [Getting started](#1-getting-started)
2. [Architecture overview](#2-architecture-overview)
3. [Adding a new page or API route](#3-adding-a-new-page-or-api-route)
4. [Working with the graph database](#4-working-with-the-graph-database)
5. [Adding a new gate type](#5-adding-a-new-gate-type)
6. [Adding a new Claude agent tool](#6-adding-a-new-claude-agent-tool)
7. [Database migrations](#7-database-migrations)
8. [Code conventions](#8-code-conventions)
9. [Pull request process](#9-pull-request-process)
10. [Architecture decisions](#10-architecture-decisions)

---

## 1. Getting started

Follow [docs/deploy/development.md](deploy/development.md) to get a local environment running.

Before starting work on a non-trivial change, open an issue to discuss the approach. This project has deliberate architectural constraints (graph-first workflows, AI as the only graph mutation path, AGPLv3 compatibility) that affect what solutions are acceptable.

Manual testing procedures for features with non-obvious test paths (e.g. the Manuscript Pipeline page, which has both a graph-driven and an enum-fallback render path) live in [docs/testing.md](testing.md). Run the relevant procedure before submitting a PR that touches any of those features, and add a new procedure when you ship a feature with state that would be easy to regress.

---

## 2. Architecture overview

The full architecture is documented in [CLAUDE.md](../CLAUDE.md). Key points:

- **Workflows are a property graph**, not application code. Gate nodes, relationships, and their parameters live in the database. Adding a new workflow step means adding a node — not writing a new code path.
- **Only Claude writes to the graph.** Application code reads the graph and evaluates gates. Mutations go through the AI agent with confirm-before-commit. Do not write code that mutates the graph directly in response to user input.
- **AGE Cypher has dialect differences from Neo4j.** Read the "Apache AGE Cypher Limitations" section in CLAUDE.md before writing any Cypher queries.
- **Row-level isolation for multi-tenancy.** All queries must be scoped by `journal_id`. There are no cross-journal queries in application code.

---

## 3. Adding a new page or API route

Pages live in `app/` following Next.js App Router conventions. Server Components are the default — use `"use client"` only when hooks or browser APIs are needed.

```
# New page
app/admin/my-section/page.tsx

# New API route
app/api/my-feature/route.ts
```

API routes that involve Claude should stream responses using the Anthropic SDK's streaming API. See `app/api/chat/route.ts` for the basic pattern and `app/api/admin/workflow-chat/route.ts` for tool use.

Add new admin pages to the sidebar nav in `app/admin/layout.tsx` and the dashboard cards in `app/admin/page.tsx`.

---

## 4. Working with the graph database

Use the helpers in `lib/graph.ts`:

```ts
import { sql, cypher, cypherMutate, withTransaction } from "@/lib/graph"

// Parameterised SQL
const journals = await sql<{ id: string; name: string }>(
  "SELECT id, name FROM manuscript.journals WHERE id = $1",
  [journalId]
)

// Read from the graph
const rows = await cypher(
  "MATCH (w:WorkflowDefinition {journal_id: $journal_id}) RETURN w.name AS name",
  ["name"]
)

// Write to the graph (always via the AI agent, not directly in page handlers)
await cypherMutate(
  "CREATE (g:Gate {type: 'COUNT_THRESHOLD_BY_DEADLINE', minimum: 3})"
)
```

**Never call `cypherMutate()` directly from a page or API route that responds to user input.** Graph mutations belong in the workflow agent's `commit_mutations` tool, after the user has confirmed the staged changes.

AGE Cypher limitations are documented in CLAUDE.md. The most common ones:
- No multi-label nodes — use a `role` property instead of `(:Person:Reviewer)`
- No multi-type relationship matching — `(n)-[:A|B|C]->(m)` is not supported
- Single-quoted strings only inside Cypher expressions
- No SQL functions inside Cypher

---

## 5. Adding a new gate type

Gate types are the conditional logic units of the workflow engine. Each type has an evaluation function in application code that reads the gate's properties and the current manuscript state, and returns `PASS`, `FAIL`, or `ESCALATE`.

To add a new gate type:

1. **Define the type** — add a new entry to the gate type registry (location TBD once the engine is built)
2. **Write the evaluation function** — takes a gate node and manuscript context, returns an outcome
3. **Document the required properties** — update the gate types table in CLAUDE.md and `docs/admin-guide/system-admin.md`
4. **Expose via the agent tool** — the `list_gate_types` tool in the workflow agent returns available types with their required properties; add the new type to this list so Claude knows about it

---

## 6. Adding a new Claude agent tool

The workflow agent tools live in `app/api/admin/workflow-chat/route.ts`. Each tool is a named function with a JSON Schema definition and an implementation.

To add a new tool:

1. Define the tool in the `tools` array with a clear `description` (Claude reads this to decide when to use it), `name`, and `input_schema`
2. Add a case to the tool execution switch
3. Keep tools discrete and single-purpose — one tool, one action
4. Tools that read the graph return data; tools that write (`stage_mutations`, `commit_mutations`) follow the confirm-before-commit pattern
5. Update the tool list in CLAUDE.md and relevant documentation

---

## 7. Database migrations

Migrations are numbered SQL files in `db/`, each with a companion shell script for execution.

Naming convention:
```
db/005_my_change.sql
db/005_my_change.sh
```

The shell script should:
1. Print a description of what it does
2. Run the SQL file against the database container
3. Print a verification query and expected output

Migrations are **append-only** — never modify an existing migration that has been committed. Add a new migration for any schema change.

---

## 8. Code conventions

**Styling:** Tailwind utility classes in JSX. Use `cn()` from `@/lib/utils` for conditional classes. No separate CSS files for component styles.

**Components:** Shadcn/ui components live in `components/ui/` — edit freely, they are owned source. Add new Shadcn components with `npx shadcn@latest add <name>`.

**Imports:** Use path aliases — `@/components/`, `@/lib/`, `@/ui/`.

**Client components:** Use `"use client"` only when required (hooks, browser APIs, event handlers). Keep the Server Component boundary as high as possible.

**Error handling:** Validate at system boundaries (user input, external APIs). Do not add defensive checks for conditions that cannot occur in correctly wired application code.

**No speculative abstractions:** Three similar lines of code is better than a premature abstraction. Build for the actual requirement, not hypothetical future ones.

---

## 9. Pull request process

1. Fork the repository and create a branch from `main`
2. Make your changes — keep PRs focused on one thing
3. Ensure `npx tsc --noEmit` passes with no errors
4. Write a clear PR description: what changed, why, and how to test it
5. For architectural changes, reference the relevant section of CLAUDE.md or open a discussion first

AGPLv3 requires that all contributions be licensed under the same terms. Do not introduce dependencies with incompatible licenses (Commons Clause, BSL, SSPL, or non-commercial restrictions).

---

## 10. Architecture decisions

Significant decisions are documented in [CLAUDE.md](../CLAUDE.md). Before proposing a change that affects the core architecture (graph storage, AI mutation pattern, tenancy model, deployment approach), read the relevant section and understand the reasoning. Some constraints exist because of the license (AGPLv3 compatibility), some because of the target operator profile (low operational burden), and some because of hard technical constraints (AGE extension availability).

Open an issue before investing significant time in a change that might conflict with these constraints.
