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
| Auth | Better Auth (MIT) |
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

## Navigation & Routing Architecture

### Entry points

**`/` — Platform landing page**
Lists all journals as cards. Journal is the primary organiser — clicking a journal card enters that journal's workspace at `/journal/[acronym]`.

**`/journal/[acronym]` — Journal workspace root**
All activity for a journal is nested under this path. The journal acronym is the URL slug and is globally unique. The layout at this level injects per-journal CSS custom properties (colours, fonts) so each journal can have its own visual identity.

**Custom domain (e.g. `AgenticES.NEJM.com`)**
A journal can be accessed via its own subdomain. The infrastructure layer (nginx / Cloudflare Transform Rule) injects `X-Journal-Acronym: NEJM` into the request. `proxy.ts` reads this header and transparently rewrites to `/journal/NEJM/...` — the visitor's URL stays as the custom domain. See `proxy.ts` for configuration examples.

---

### Role-to-path mapping

All paths are nested under `/journal/[acronym]/`:

| Role | Path |
|---|---|
| `author` | `/journal/[acronym]/author` |
| `reviewer` | `/journal/[acronym]/reviewer` |
| `assistant_editor` | `/journal/[acronym]/editorial/assistant-editor` |
| `editor` | `/journal/[acronym]/editorial/editor` |
| `editor_in_chief` | `/journal/[acronym]/editorial/editor-in-chief` |
| `editorial_support` | `/journal/[acronym]/editorial/editorial-support` |
| `system_admin` | `/admin` (no journal scope) |

---

### Header controls (editorial workspace)

The editorial layout header contains two switchers:

- **Journal selector** — switches between all journals the user has access to, routing to `/journal/[newAcronym]/editorial`
- **Role selector** — jumps between all role centers for the current journal (Author, Reviewer, Assistant Editor, Editor, Editor-in-Chief, Editorial Support) without returning to the landing page

---

### Route structure

```
proxy.ts                                      # Custom domain → /journal/[acronym] rewrite
app/
  page.tsx                                    # Platform landing — journal grid
  journal/
    page.tsx                                  # Redirects to first journal (or /admin/journals)
    [acronym]/
      layout.tsx                              # Theming wrapper — injects per-journal CSS vars
      page.tsx                                # Redirects to /journal/[acronym]/editorial
      author/page.tsx                         # Author portal
      reviewer/page.tsx                       # Reviewer portal
      editorial/
        layout.tsx                            # Shared layout: journal selector, role selector, sidebar
        page.tsx                              # Redirects to role-specific dashboard (post-auth)
        assistant-editor/page.tsx             # AE dashboard: queue stats, checklist intake
        editor/page.tsx                       # Editor dashboard: decisions, reviewer reports
        editor-in-chief/page.tsx              # EIC dashboard: escalations, oversight
        editorial-support/page.tsx            # Support dashboard: correspondence, admin tasks
        queue/page.tsx                        # Checklist queue (shared across roles)
        manuscripts/[id]/page.tsx             # Manuscript detail + AI checklist
      admin/                                  # Journal configuration (admin-only)
        page.tsx                              # Admin dashboard
        manuscript-types/                     # Submission type CRUD
        workflows/                            # Workflow definitions
        workflow/                             # AI workflow config chat
        email-templates/                      # Email template CRUD
        users/                                # Journal users CRUD
        troubleshooting/                      # AI troubleshooting chat
  admin/                                      # System admin (no journal scope)
```

---

## Admin Structure — Two Levels

There are two distinct admin spaces with different scopes and audiences:

### `/admin/` — System Admin
Accessible only to system administrators. This is the initial setup workspace — typically one expert at a large organisation who configures everything before handing off to journal admins. Sections:
- **Journals** — add journals, disable journals (prevent new submissions), set journal acronym
- **Users** — system-level user management
- **Manuscript Types** — submission type definitions
- **Email Templates** — email template CRUD
- **Workflows** — all workflow definitions (read)
- **Workflow Config** — Claude chat for creating and modifying workflows across any journal
- **Troubleshooting** — Claude chat for diagnosing issues across any journal
- **Graph View** — read-only sigma.js visualisation of the full workflow graph

**Only Claude writes to the graph.** The Graph View is read-only by design — direct graph editing requires expertise that 99.9% of users will not have.

### `/editorial/[acronym]/` — Editorial Workspace
The day-to-day working area for all editorial roles. Shared layout (sidebar, journal selector, role selector) with role-specific dashboard pages as the default landing. Sections:
- **Role dashboards** — `assistant-editor`, `editor`, `editor-in-chief`, `editorial-support`
- **Checklist Queue** — newly submitted manuscripts awaiting admin review
- **Manuscript detail** — AI checklist, override controls, pass/unsubmit/reject actions

### `/journal-admin/[acronym]/` — Journal Admin
Configuration and settings for a specific journal. Separate from the editorial workspace — editors work in `/editorial/`, journal admins configure in `/journal-admin/`. Sections:
- Dashboard
- Manuscript types
- Workflows
- Workflow Config (AI chat)
- Email templates
- Users (people with roles on this journal)
- Troubleshooting (AI chat)

**Journal selector:** Shown in the journal-admin layout header. System admins see all journals plus a link back to `/admin/`. Journal admins see only their assigned journals. If a user has exactly one journal, skip the picker and redirect directly to that journal's workspace.

**Acronym as slug:**
- Journal acronyms are stored uppercase (enforced in `actions.ts`)
- Globally unique across all journals — enforced by `UNIQUE` constraint on `manuscript.journals.acronym`
- Required field — a journal cannot be created without one
- URL lookups should be case-insensitive (`WHERE UPPER(acronym) = UPPER($1)`) to handle direct URL entry

---

## Authentication

**Provider: [Better Auth](https://better-auth.com) (MIT)**

Better Auth is a TypeScript-first, self-hosted authentication library. It is the right fit for small-to-medium editorial offices — simple to operate, no external auth service required, and MIT-licensed so it's compatible with this project's AGPLv3 license. Larger organisations that need SSO/SAML or enterprise identity providers can integrate their own auth solution; by the terms of AGPLv3, they must release those modifications as source code.

---

### How Better Auth integrates

Better Auth uses the `pg` Pool adapter — it connects directly to the same PostgreSQL database and manages its own schema tables. It does **not** use this project's `sql()` helper; it runs its own queries internally.

```ts
// lib/auth.ts
import { betterAuth } from "better-auth"
import { Pool } from "pg"

export const auth = betterAuth({
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: {
      system_admin: { type: "boolean", defaultValue: false },
    },
  },
})
```

Better Auth's CLI generates and runs its own migrations for the auth tables. Run them separately from the app's `db/migrate.sh`.

**Better Auth manages these tables** (in the `public` schema by default — consider moving to an `auth` schema via `advanced.database.schema`):
- `user` — id, name, email, emailVerified, system_admin (custom field)
- `session` — id, token, userId (FK), expiresAt
- `account` — OAuth provider links
- `verification` — email verification and password reset tokens

---

### Linking auth users to editorial people

Better Auth's `user` table handles authentication. The app's `manuscript.people` table handles editorial identity (journal assignments, roles, ORCID, etc.). They are linked by `auth_user_id`:

```sql
-- Add to manuscript.people (migration 004)
ALTER TABLE manuscript.people ADD COLUMN auth_user_id TEXT UNIQUE REFERENCES public.user(id);
```

When a user logs in, the app looks up their `manuscript.people` record by `auth_user_id` to determine journal assignments and editorial roles.

---

### Session access in Next.js App Router

Use per-page session checks in Server Components — this is the secure pattern recommended by Better Auth. Do not rely on middleware alone.

```ts
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

const session = await auth.api.getSession({ headers: await headers() })
if (!session) redirect("/login")
```

---

### System admin flag

The `system_admin` boolean is a custom field on the Better Auth `user` record. It is set manually by an operator (direct DB update or a future admin tool). System admins can access `/admin` and see all journals. All other users are scoped to journals they have roles on.

This avoids needing a separate `system_admins` table and keeps auth state in one place.

---

### Post-login routing

After authentication, the app determines where to send the user:

1. Look up the user's `manuscript.people` record via `auth_user_id`
2. Query their `manuscript.person_roles` to find journals and roles
3. Apply routing rules:

```
system_admin = true           → /admin
role = author                 → /author/[acronym]
role = reviewer               → /reviewer/[acronym]
role ∈ {assistant_editor,     → /journal-admin/[acronym]
        editor,
        editor_in_chief,
        editorial_support}
```

4. If the user has the same role on **multiple journals**, show a journal picker before routing
5. If the user has **no roles** (account exists but not yet provisioned), show a "contact your editorial office" message

When arriving from `/journal/[acronym]`, the journal is already known — skip step 4 and route directly.

---

### Auth routes

Better Auth's catch-all handler mounts at `/api/auth/[...all]`:

```ts
// app/api/auth/[...all]/route.ts
import { auth } from "@/lib/auth"
import { toNextJsHandler } from "better-auth/next-js"
export const { GET, POST } = toNextJsHandler(auth)
```

Login, logout, session refresh, email verification, and password reset all go through this route automatically.

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

## Admin-Configurable Settings

Many aspects of the system must be configurable per journal by administrators without code changes. Settings fall into three categories with different storage strategies.

**Rule: use the graph for conditional logic and state transitions; use relational tables for configuration data that the graph operates on.**

| Setting type | Storage | Admin UI |
|---|---|---|
| Ordered questions / form fields | `manuscript.form_fields` (relational) | Drag-to-reorder CRUD panel |
| Scalar journal config | `manuscript.journal_settings` key-value | Settings form per journal |
| Workflow-conditional checks | Graph gate nodes | Workflow config chat (Claude) |

---

### Ordered form fields — `manuscript.form_fields`

Used for anything that is a configurable list of questions or fields: submission checklists, author signup fields, manuscript submission form questions. One table covers all form types via a `form_type` discriminator.

**Planned schema:**

```sql
CREATE TABLE manuscript.form_fields (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_id    UUID NOT NULL REFERENCES manuscript.journals(id),
    form_type     TEXT NOT NULL,   -- 'checklist' | 'submission' | 'signup'
    label         TEXT NOT NULL,
    field_type    TEXT NOT NULL DEFAULT 'boolean',  -- 'boolean' | 'text' | 'select' | 'date'
    options       JSONB,           -- for 'select' fields: ["Option A", "Option B"]
    required      BOOLEAN NOT NULL DEFAULT false,
    display_order INT NOT NULL DEFAULT 0,
    active        BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

An optional `manuscript_type_id` FK can be added later to scope checklists to specific manuscript types.

**Admin UI:** A drag-to-reorder list with add/edit/toggle-active controls. This is structured enough that a traditional CRUD panel is faster and less error-prone than AI translation — do not use the workflow config chat for this.

---

### Scalar journal settings — `manuscript.journal_settings`

Used for named configuration values that don't warrant their own columns: deadline defaults, reviewer count thresholds, feature flags, etc.

**Planned schema:**

```sql
CREATE TABLE manuscript.journal_settings (
    journal_id   UUID NOT NULL REFERENCES manuscript.journals(id),
    key          TEXT NOT NULL,
    value        TEXT NOT NULL,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (journal_id, key)
);
```

Known keys are documented in application code. Unknown keys are ignored — this avoids schema migrations for every new setting. Example keys: `review_deadline_days`, `min_reviewers`, `max_reviewers`, `allow_author_reviewer_suggestions`.

---

### Workflow-conditional checks (graph)

Questions or tasks that are **part of a workflow step** — e.g. "author must confirm ethics compliance before submission advances past triage" — belong in the graph as gate or task nodes with the condition encoded as a property. The `form_fields` table handles *which questions exist*; the graph handles *when they're evaluated and what happens next*.

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
proxy.ts                                      # Custom domain → /journal/[acronym] rewrite
docker-compose.yml                            # Self-hosted: app + postgres-age + minio
db/
  init.sql                                    # Schema creation (manuscript, workflow, history schemas)
  migrate.sh                                  # Run numbered migration scripts
  seed.sql / seed_full.sql                    # Dev seed data
  002_manuscript_types.*                      # Migration: manuscript types table
  003_journal_acronym.*                       # Migration: acronym column + unique constraint
  004_credit.*                                # Migration: CRediT contributor roles
app/
  layout.tsx                                  # Root layout
  page.tsx                                    # Platform landing — journal grid
  globals.css                                 # Tailwind v4 global styles
  admin/                                      # System admin (no journal scope)
    layout.tsx
    page.tsx                                  # System admin dashboard
    journals/                                 # Add / disable journals; set acronym
    manuscript-types/                         # System-level manuscript type CRUD
    email-templates/                          # System-level email template CRUD
    users/                                    # System-level user CRUD
    workflows/                                # Workflow list
    workflow/                                 # AI workflow config chat
    troubleshooting/                          # AI troubleshooting chat
  journal/
    page.tsx                                  # Redirects to first journal (or /admin/journals)
    [acronym]/
      layout.tsx                              # Theming wrapper — injects per-journal CSS vars
      page.tsx                               # Redirects to /journal/[acronym]/editorial
      author/page.tsx                         # Author portal
      reviewer/page.tsx                       # Reviewer portal
      editorial/
        layout.tsx                            # Shared layout: journal selector, role selector, sidebar
        page.tsx                              # Redirects to role-specific dashboard (post-auth)
        journal-selector.tsx
        role-selector.tsx
        assistant-editor/page.tsx             # AE dashboard: queue stats, checklist intake
        editor/page.tsx                       # Editor dashboard: decisions, reviewer reports
        editor-in-chief/page.tsx              # EIC dashboard: escalations, oversight
        editorial-support/page.tsx            # Support dashboard: correspondence, admin tasks
        queue/page.tsx                        # Checklist queue (shared across roles)
        manuscripts/[id]/
          page.tsx                            # Manuscript detail
          checklist.tsx                       # AI checklist component
          actions.ts
      admin/                                  # Per-journal admin (configuration)
        layout.tsx
        journal-selector.tsx
        page.tsx                              # Journal admin dashboard
        manuscript-types/                     # Submission type CRUD
        workflows/                            # Workflow definitions
        workflow/                             # AI workflow config chat
        email-templates/                      # Email template CRUD
        users/                               # Journal users CRUD
        troubleshooting/                      # AI troubleshooting chat
  api/
    chat/route.ts                             # General Claude streaming chat (POST /api/chat)
    admin/
      workflow-chat/route.ts                  # Workflow config chat — graph read/write tools
      troubleshooting-chat/route.ts           # Troubleshooting chat
    journal-admin/
      checklist-evaluate/route.ts             # AI checklist evaluation
components/
  chat.tsx                                    # Chat UI client component
  workflow-chat.tsx                           # Workflow config chat UI
  journal-grid.tsx                            # Platform landing journal cards
  journal-picker.tsx                          # Multi-journal picker
  theme-provider.tsx
  theme-toggle.tsx
  ui/                                         # Shadcn components (owned source)
    button.tsx
    dialog.tsx
    input.tsx
    label.tsx
lib/
  graph.ts                                    # Graph DB client and Cypher query helpers
  credit.ts                                   # CRediT contributor role definitions
  utils.ts                                    # cn() helper (tailwind-merge + clsx)
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
