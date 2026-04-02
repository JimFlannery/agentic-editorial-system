# Agentic Editorial System — Claude Code Guide

This is a **TRAINS** stack project: **T**ailwind · **R**eact · **AI** · **N**ext.js · **S**hadcn

## What This Project Is

An open-source, AGPLv3-licensed editorial management system for academic publishing. The core innovation is that **all editorial workflows are stored as a property graph** rather than being hardcoded. Participants (editors, reviewers, authors) are nodes; actions and handoffs are directed relationships. This makes workflows infinitely configurable without code changes.

The system also integrates **agentic AI** — Claude agents traverse the graph to automate tasks like reviewer selection, conflict-of-interest detection, and status-based notifications.

See `README.md` for full project context.

---

## Stack Versions

| Tech | Version |
|------|---------|
| Next.js | 16 (App Router) |
| React | 19 |
| Tailwind CSS | v4 |
| Shadcn/ui | v4 |
| Anthropic SDK | latest |
| Graph + Relational DB | PostgreSQL + Apache AGE extension |
| Object Storage | MinIO (self-hosted) or any S3-compatible service |

---

## Target Operators

Journal editorial offices, learned societies, and independent publishers. Most are small operations without dedicated infrastructure teams. Design decisions should always favour:

- **Low operational burden** — one instance, one database, minimal moving parts
- **Familiar deployment targets** — Docker Compose for self-hosted, AWS Elastic Beanstalk multi-container for cloud
- **AI-guided setup** — all installation and configuration steps are written for a Claude agent to execute, not just a human to read. `INSTALL.md` is the agent's instruction set.
- **Swappable infrastructure** — object storage, email provider, and auth provider should be configurable via environment variables with no code changes

---

## Deployment Architecture

Apache AGE is a C extension that must be compiled into Postgres. Most managed Postgres services (AWS RDS, Supabase, Aiven) do not support it. This shapes all deployment options. Only two managed database services are known to support AGE:

- **Azure Database for PostgreSQL Flexible Server** — fully managed, GA support for AGE since May 2025
- **Railway** — platform-managed (not fully managed), one-click Apache AGE template

Everything else requires running Postgres in a Docker container.

---

### Tier 1 — Recommended (lowest friction, no server management)

**Best for:** Editorial offices and societies with limited technical staff.

| Component | Service | Notes |
|---|---|---|
| Database | Railway (Apache AGE template) | One-click deploy, persistent volume, ~$10–20/mo |
| App | Railway (Docker container) | Same platform, no timeout issues for agentic tasks |
| File storage | Cloudflare R2 or AWS S3 | S3-compatible API; R2 has no egress fees |

Railway hosts both the database and app on one platform. No servers to manage. The AGE template (`railway.com/deploy/apache-age`) deploys the official `apache/age` Docker image with persistent storage pre-configured. **Caveat:** Railway does not provide automatic database backups or point-in-time recovery — configure a scheduled `pg_dump` job. Estimated total: **$20–40/month** for a small journal.

> **Why not Vercel for the app?** Vercel's serverless functions time out at 60 seconds (Pro plan). Agentic Claude tasks (reviewer selection, conflict detection) can run longer. Railway runs persistent containers — no timeout issues.

---

### Tier 2 — Azure (fully managed, enterprise-grade)

**Best for:** Institutions that need HA, automated backups, and point-in-time recovery.

| Component | Service | Notes |
|---|---|---|
| Database | Azure Database for PostgreSQL Flexible Server | Only fully managed Postgres with official AGE support; ~$15–25/mo (Burstable B1ms) |
| App | Azure Container Apps or App Service | Runs Docker container |
| File storage | Azure Blob Storage or AWS S3 | S3-compatible with the right SDK |

Azure is the only major cloud provider with a fully managed Postgres service that officially supports AGE (GA May 2025). Automated backups, HA, PITR, and monitoring are included. More setup than Railway but significantly lower ongoing operational burden than running your own containers. **Caveat:** AGE is not supported during major version upgrades (must drop the extension first).

---

### Tier 3 — AWS (S3-centric organisations)

**Best for:** Teams already in the AWS ecosystem.

| Component | Service | Notes |
|---|---|---|
| Database | Elastic Beanstalk container (apache/age image) | RDS cannot be used — AGE not supported |
| App | Elastic Beanstalk multi-container | Same environment as database container |
| File storage | AWS S3 | Set S3_* env vars; MinIO not needed |

**Note:** AWS RDS does not support Apache AGE. Postgres must run in a container even on AWS. This is the main operational difference vs. Azure Tier 2.

---

### Tier 4 — Self-hosted (full control, lowest cost)

**Best for:** Technical teams, institutions with existing infrastructure, or anyone wanting full control.

Three containers, one `docker-compose.yml`:

```
┌─────────────────────────────────┐
│  app         (Next.js)  :3000   │
├─────────────────────────────────┤
│  postgres-age           :5432   │  ← apache/age Docker image
├─────────────────────────────────┤
│  minio                  :9000   │  ← swap for any S3-compatible service
└─────────────────────────────────┘
```

Run on any VPS (DigitalOcean, Hetzner, Linode). MinIO provides local S3-compatible storage; operators can swap it for any S3-compatible service via environment variables. Cheapest option — a small Hetzner VPS costs ~$5–10/month. Operator is responsible for backups and uptime.

---

## AI-Guided Installation

`INSTALL.md` (to be written) is the primary installation document. It is written specifically for a Claude agent to execute — numbered steps, exact shell commands, environment variable templates with descriptions, and verification checks after each step. Operators point their Claude Code session at `INSTALL.md` and let the agent handle the setup.

When writing or updating `INSTALL.md`, follow these conventions:
- Every step has a verification command the agent can run to confirm success
- Environment variables are documented with type, default, and whether required or optional
- Failure modes are documented inline so the agent can self-diagnose
- No step assumes prior context — each step is self-contained

---

## Multi-Journal Tenancy

One system instance hosts multiple journals. `Journal` is a first-class node in the graph. All workflow definitions, reviewer pools, editorial teams, and manuscripts belong to a Journal node.

**Tenancy model: row-level isolation.** All journals share one Postgres instance and one database. Every query is scoped by `journal_id`. This is the right default for the target audience — simple to operate, backup, and restore. Schema-per-journal or database-per-journal is unnecessary complexity at this scale.

**Cross-journal roles:** A person can hold different roles across journals. The graph handles this naturally — a Person node can have `[:IS_EDITOR {journal_id}]` on one Journal and `[:IS_REVIEWER {journal_id}]` on another. Role lookups are always scoped to the current journal context.

**Journal node properties (draft):**
- `name`, `issn`, `subject_area`
- `submission_email` — the inbound address for new submissions
- `default_workflow` — points to the WorkflowDefinition used for standard submissions
- `review_deadline_days` — journal-level default, overridable per manuscript type

**Isolation boundaries:** Editors and reviewers on Journal A cannot see Journal B's manuscripts, reviewer pool, or workflow configuration. System administrators (who manage the installation) can see all journals.

---

## Data Architecture

Two stores, not three:

```
PostgreSQL + Apache AGE extension
├── workflow schema   ← property graph (Cypher via AGE): workflow definitions,
│                       gate nodes, relationships, email templates, reviewer pools
├── history schema    ← append-only events table (SQL): every gate evaluation,
│                       state transition, and action per manuscript
└── manuscript schema ← relational SQL: manuscript metadata, people, roles, assignments

MinIO (S3-compatible object storage)
└── Binary files: manuscripts (PDF/Word/LaTeX), figures, supplementary materials,
    reviewer attachments, revision archives
```

**Why Apache AGE over a dedicated graph DB (Neo4j, ArangoDB, etc.):** All major dedicated graph databases now use SaaS-restricting licenses (Commons Clause, BSL, SSPL) that are incompatible with AGPLv3 SaaS hosting without a commercial license. Apache AGE is Apache 2.0 — no restrictions. Performance is not a concern: editorial workflows are low-frequency event-driven operations (hundreds of gate evaluations per day system-wide, not per second). Apache AGE's Cypher support is sufficient for shallow editorial workflow graphs.

**Deployment note:** Apache AGE must be installed as a Postgres extension. Self-hosted Postgres with AGE (via Docker) is the expected path. The official `apache/age` Docker image handles this.

**Why MinIO:** S3-compatible API means operators can swap in any S3-compatible service (AWS S3, Cloudflare R2, Backblaze B2) with no code changes. MinIO itself is AGPLv3, consistent with the project license.

---

## Open Architectural Decisions

1. ~~**Graph database choice**~~ — **DECIDED: PostgreSQL + Apache AGE.** See Data Architecture above.

2. ~~**Workflow logic gate placement**~~ — **DECIDED: dedicated Gate nodes** (Option B). Gate nodes are first-class queryable entities with typed outgoing relationships (`[:ON_PASS]`, `[:ON_FAIL]`, `[:ON_ESCALATE]`, `[:ON_TIMEOUT]`). The application evaluates gates generically by type; specific parameters (thresholds, deadlines) live in the graph. See Gate Node Model section below.

3. **Authentication and role model** — Roles include: Author, Reviewer, Assistant Editor, Editor, Editor-in-Chief, Editorial Support. Roles are nodes in the graph, not just application-level permissions. The role graph and the workflow graph are likely the same graph.

---

## Domain Model (Draft)

**Node types:**
- `Journal` — top-level tenant node; all other nodes belong to a Journal
- `Manuscript` — the submission, with properties like type, subject area, status
- `Person` — with subtype labels: `Author`, `Reviewer`, `AssistantEditor`, `Editor`, `EditorInChief`, `EditorialSupport`
- `Review` — a submitted review, linked to a Manuscript and a Reviewer
- `EmailTemplate` — reusable templates attached to communication action nodes
- `WorkflowDefinition` — a named subgraph defining a manuscript type's full lifecycle; belongs to a Journal
- `Task` — a unit of work assigned to a Person, with status and deadline properties
- `Gate` — a condition node that evaluates on a trigger event and routes to the next action via typed outcome relationships (see Gate Node Model below)

**Relationship types (examples):**
- `[:SUBMITTED]` — Author → Manuscript
- `[:ASSIGNED_TO]` — Manuscript → AssistantEditor
- `[:INVITED_TO_REVIEW]` — AssistantEditor → Reviewer (on a Manuscript)
- `[:SUBMITTED_REVIEW]` — Reviewer → Review → Manuscript
- `[:SENT_DECISION]` — Editor → Manuscript (with decision property)
- `[:USES_TEMPLATE]` — communication node → EmailTemplate
- `[:FOLLOWS_WORKFLOW]` — Manuscript → WorkflowDefinition
- `[:ON_PASS]`, `[:ON_FAIL]`, `[:ON_ESCALATE]`, `[:ON_TIMEOUT]` — Gate → next action node

---

## Gate Node Model

Gates are the conditional logic of the workflow. They are event-driven: each gate listens for a trigger event, evaluates when that event fires, and follows the matching outcome relationship.

**Gate node properties:**

| Property | Type | Purpose |
|---|---|---|
| `type` | string | Determines the evaluation function |
| `trigger_event` | string | Event that causes evaluation (e.g. `review.submitted`, `deadline.passed`) |
| `minimum` | int | Threshold for COUNT_THRESHOLD gates |
| `entity` | string | Node type to count/check |
| `status_filter` | string | Filter applied to entity query |
| `deadline_days` | int | For DEADLINE_PASSED gates |
| `evaluated_at` | datetime | Timestamp of last evaluation |
| `outcome` | string | Last outcome (`PASS`, `FAIL`, `ESCALATE`) |

**Gate types (planned):**

| Type | Evaluates to PASS when... |
|---|---|
| `COUNT_THRESHOLD_BY_DEADLINE` | N entities reach target status before deadline |
| `ALL_COMPLETE` | Every linked entity has status = complete |
| `ANY_OF` | At least one linked entity has status = complete |
| `DEADLINE_PASSED` | Current time exceeds deadline property |
| `MANUAL_APPROVAL` | A Person node explicitly releases the gate |
| `EXTERNAL_SIGNAL` | A webhook or API call sets outcome = PASS |

**Example: Review deadline gate with branching:**

```
(ReviewDeadlineGate:Gate {
  type: "COUNT_THRESHOLD_BY_DEADLINE",
  trigger_event: "review.submitted",
  minimum: 3,
  entity: "Review",
  status_filter: "submitted",
  deadline_days: 21
})
  -[:ON_PASS]->  (EditorDecisionTask)
  -[:ON_FAIL]->  (SendLateReminderEmail { template: "LateReviewerReminder", target: "DYNAMIC:Review:overdue" })
```

The `target: "DYNAMIC:Review:overdue"` is resolved at evaluation time — the app queries the graph for Review nodes on this Manuscript that are missing or overdue.

**Loop / escalation pattern:** The ON_FAIL path can route back to another gate with a new deadline, creating a bounded loop. The loop terminates via an escalation branch (e.g. second missed deadline → ESCALATE to Editor-in-Chief). Loop depth is encoded in the graph structure, not in application code.

**Event system:** Every write to the graph emits a typed event. Gates register their `trigger_event`. On event fire, the app finds all Gate nodes on that Manuscript matching the event and evaluates them in sequence.

---

## Admin Workflow Configuration (AI-Assisted)

The graph model is powerful but not directly operable by non-technical administrators. Editors migrating from Editorial Manager or ScholarOne are domain experts, not graph engineers. Claude is the translation layer.

### Admin Panel Design Principle

The **raw graph is not the default admin interface**. The default interface is a Claude chat in the admin panel where administrators describe their workflow in plain language. Claude translates this into graph mutations and renders a linear workflow visual for confirmation. The graph view is accessible as a power-admin option.

### Workflow Configuration Chat — API Route

`app/api/admin/workflow-chat/route.ts` handles the admin workflow configuration chat. Unlike the general chat route, this route:

- Has access to **graph read/write tools** (via Claude tool use)
- Is scoped to a specific `journal_id` (passed in the request, verified against the authenticated admin's permissions)
- Operates in a **confirm-before-commit** pattern: Claude stages mutations and describes them in plain language; the admin sends an explicit confirmation message before the mutations are applied
- After committing, returns a **linearised workflow representation** (ordered list of steps with branching shown inline) for the admin to verify

### Tool use in the workflow config agent

Use Claude tool use with discrete, named tools so the admin can see what the agent is doing:

| Tool | Purpose |
|---|---|
| `get_workflow` | Fetch the current WorkflowDefinition subgraph for a journal |
| `describe_workflow` | Convert a graph subgraph to a human-readable linear description |
| `stage_mutations` | Prepare Cypher mutations without applying them; returns a plain-language diff |
| `commit_mutations` | Apply staged mutations — only callable after admin confirms |
| `list_gate_types` | Return available Gate types and their required properties |
| `list_email_templates` | Return email templates available to the journal |

### Linear workflow visual

When rendering a workflow for admin review, output a linear step list in this format — branches are shown as indented sub-lists:

```
1. Manuscript submitted by Author
2. Assigned to Assistant Editor
3. Invitations sent to 3 Reviewers
4. [GATE] 3 reviews submitted within 21 days?
   ├── PASS → Editor decision task created
   └── FAIL → Late reminder sent to overdue reviewers; 7-day extension
              [GATE] Still missing reviews after extension?
              ├── PASS → Editor decision task created
              └── ESCALATE → Editor-in-Chief notified
```

This format is renderable in Markdown and in a React component — do not require a graph rendering library for the default view.

---

## Agentic AI Pattern

Claude agents will traverse the graph to perform multi-step editorial tasks. The first target is **reviewer selection**:

1. Agent receives a `Manuscript` node ID and the requesting `AssistantEditor` node ID
2. Agent queries the graph for `Reviewer` nodes matching the manuscript's subject area
3. Agent scores each candidate by: recency of last assignment, relationship distance from `Author` nodes (conflict detection), historical quality metrics
4. Agent returns a ranked shortlist with reasoning
5. AssistantEditor confirms or overrides via the UI

When implementing agentic features, use Claude tool use (function calling) to keep graph queries as discrete, inspectable steps rather than one large prompt. This allows the UI to show the agent's reasoning transparently.

---

## Project Structure

```
app/
  api/chat/route.ts       # Claude streaming API route (POST /api/chat)
  globals.css             # Tailwind v4 global styles
  layout.tsx              # Root layout
  page.tsx                # Home page
components/
  chat.tsx                # Chat UI client component
  ui/
    button.tsx            # Shadcn Button component
lib/
  utils.ts                # cn() helper (tailwind-merge + clsx)
```

As the project develops, expect to add:
```
lib/
  graph.ts                # Graph DB client and query helpers
  workflow.ts             # Workflow traversal logic
app/
  api/workflow/           # Workflow state API routes
  api/agent/              # Agentic task API routes
  api/admin/workflow-chat/route.ts  # Workflow config chat (admin panel)
  dashboard/              # Editor dashboard
  submission/             # Author submission flow
  admin/                  # Admin panel (journal config, workflow builder)
```

---

## Apache AGE Cypher Limitations

These are known AGE dialect differences from standard Neo4j Cypher — do not use these patterns:

- **WorkflowDefinition uses `[:FIRST_STEP]`** to point to the first node — not `[:STARTS_WITH]`. Steps connect via `[:NEXT]`. Nodes use `name` property (not `label`) and `position` for ordering.
- **No multi-type relationship matching** — `(n)-[:A|B|C]->(m)` is not supported. Query each relationship type separately and merge results in application code.
- **No SQL functions in Cypher** — `gen_random_uuid()`, `now()`, etc. are SQL functions and cannot be used inside `cypher()` calls.
- **Single labels only** — `(:Person:Reviewer)` multi-label nodes are not supported. Use a `role` property instead.
- **Single-quoted strings only** — Use `{name: 'value'}` not `{name: "value"}` inside Cypher expressions.
- **Always use `cypherMutate()`** for CREATE/MERGE/SET/DELETE — never `cypher(query, [])` with an empty aliases array, which generates an invalid `AS ()` clause.

---

## Key Conventions

### Styling
- Use **Tailwind utility classes** directly in JSX — no separate CSS files for component styles
- Use the `cn()` helper from `@/lib/utils` to merge conditional classes:
  ```ts
  import { cn } from "@/lib/utils"
  cn("base-class", condition && "conditional-class")
  ```
- Dark mode uses the `dark:` variant — the app supports light and dark out of the box

### Components
- Shadcn/ui components live in `components/ui/` — you own the source, edit freely
- Add new Shadcn components with: `npx shadcn@latest add <component-name>`
- Use `"use client"` at the top of any component that uses hooks or browser APIs

### Imports
Path aliases are configured in `tsconfig.json`:
- `@/components/...` → `components/`
- `@/lib/...` → `lib/`
- `@/ui/...` → `components/ui/`

### API Routes
- All API routes live under `app/api/`
- The Claude chat route is at `app/api/chat/route.ts` and streams responses

---

## Claude API Integration

**Model:** `claude-opus-4-6` with `thinking: { type: "adaptive" }`

**Pattern:** The chat UI (`components/chat.tsx`) sends `POST /api/chat` with the full message history. The route streams back plain text chunks using the Anthropic SDK's streaming API.

**Adding tools or changing the system prompt:** Edit `app/api/chat/route.ts`.

**Env var required:**
```
ANTHROPIC_API_KEY=sk-ant-...
```
Add to `.env.local` (already gitignored). Get a key at https://console.anthropic.com.

---

## Common Tasks

| Task | Command / Location |
|------|--------------------|
| Run dev server | `npm run dev` |
| Add a Shadcn component | `npx shadcn@latest add <name>` |
| Change Claude model | `app/api/chat/route.ts` → `model` field |
| Change system prompt | `app/api/chat/route.ts` → `system` field |
| Add a new page | Create `app/<route>/page.tsx` |
| Add a new API route | Create `app/api/<route>/route.ts` |
