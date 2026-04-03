# Agentic Editorial System

An open-source agentic editorial management system for academic and scientific publishing, built on a graph database workflow engine and the TRAINS (Tailwind, React, AI, Next.js, Shadcn) stack. Licensed under [AGPLv3](LICENSE).

> **Status:** Active development — core stack, admin console, AI workflow configuration, journal workspace routing, and multi-journal admin architecture live

---

## The Problem

Existing editorial management systems (e.g. ScholarOne, Editorial Manager) are configurable — but the configuration process is complex enough that journals cannot do it themselves. Vendors are routinely involved in what should be routine changes: adjusting a review deadline, adding a new manuscript type, modifying a decision workflow. Anything beyond what the configuration layer allows requires working with a technical team to develop and deploy new features.

The result is that journals are effectively locked into whatever the vendor has set up for them. Changes are expensive and slow. The systems serve a niche academic market, which keeps prices high and makes vendors the bottleneck for innovation. Open-source alternatives exist but replicate the same architecture — complexity is the product, not a flaw.

---

## The Idea: Workflow as a Graph

Think of a graph the way you'd think of a map. A map has **places** (cities, landmarks) connected by **roads** (routes between them). A property graph works the same way: it has **things** (people, manuscripts, tasks) connected by **relationships** (submitted, assigned to, reviewed by). You can follow the connections to understand how everything relates — just like tracing a route on a map.

In this system, your editorial workflow *is* that map. People, manuscripts, decisions, and deadlines are the places. The rules about who does what, and in what order, are the roads between them. Changing a workflow means redrawing part of the map — not rewriting software.

This system stores all editorial workflows as a **property graph**. Every participant is a node; every action or handoff is a directed relationship between nodes. Workflows are not hardcoded — they are data.

### Example: Review Article Workflow

```
[Author] --submits--> [Manuscript]
[Manuscript] --assigned-to--> [Assistant Editor]
[Assistant Editor] --invites--> [Reviewer 1]
[Assistant Editor] --invites--> [Reviewer 2]
[Assistant Editor] --invites--> [Reviewer 3]
[Reviewer 1] --submits--> [Review]
[Reviewer 2] --submits--> [Review]
[Reviewer 3] --submits--> [Review]
[Editor] --reads--> [Review x3]
[Editor] --sends--> [Decision Email] --uses--> [Email Template: Major Revision]
[Decision Email] --notifies--> [Author]
```

A different manuscript type simply uses a different subgraph. No code changes needed — just a different workflow definition stored in the database.

### Logic Gates

Conditional logic is encoded as **Gate nodes** in the graph — first-class queryable entities, not application code. Each gate has a type, parameters, and typed outgoing relationships (`ON_PASS`, `ON_FAIL`, `ON_ESCALATE`) pointing to the next action. Gates evaluate on events (a reviewer submits, a deadline passes). The application evaluates gates generically by type; the specific thresholds and deadlines live in the graph itself.

Example: a `COUNT_THRESHOLD_BY_DEADLINE` gate with `minimum: 3` on a Review Article either passes (all 3 reviewers submitted by deadline) or fails (one or more are late — trigger a reminder email to the late reviewers specifically, then re-evaluate after an extension).

### Multi-Journal Support

One installation hosts multiple journals. Each journal has its own editorial team, reviewer pool, workflow definitions, manuscript queue, and configurable settings. Roles are journal-scoped — a person can be an editor on one journal and a reviewer on another. Each journal has a globally unique acronym that serves as its URL slug throughout the system.

---

## Agentic AI Integration

Because the workflow is a graph, AI agents can traverse and act on it naturally. Two core agentic features are planned.

### 1. AI-Assisted Workflow Configuration and Troubleshooting (Admin Panel)

The graph model solves the vendor lock-in problem — but only if administrators can actually author and modify workflow graphs. Editors migrating from ScholarOne or Editorial Manager are domain experts, not graph database engineers. The raw graph should not be the default interface.

The admin panel includes a **Claude chat interface** that operates in two modes.

**Workflow configuration:** An administrator describes their workflow in plain language:

> *"We need three reviewers for a research article. If all three submit within 21 days, the editor is notified. If one is late, send them a reminder and give a 7-day extension. If two are late after the extension, escalate to the Editor-in-Chief."*

Claude translates this into graph mutations — creating Gate nodes, setting thresholds, wiring outcome relationships — and then renders a **linear visual of the resulting workflow** back to the administrator for confirmation before committing. The visual is the primary feedback loop; the graph itself is accessible for power admins but not the default view.

**Troubleshooting:** When something goes wrong — a manuscript is stuck, a reviewer never got an invitation, a decision email didn't go out — the admin describes the problem in the same chat and Claude diagnoses it:

> *"Manuscript 47 hasn't moved in two weeks."*

Claude queries the manuscript's current gate state, task assignments, reviewer invitations, and event history, then explains what went wrong and what it will do to fix it. The same confirm-before-commit rule applies — Claude stages the corrective action and waits for explicit approval. No support ticket, no vendor call.

This makes editorial offices genuinely self-reliant. Routine problems that previously required vendor or IT involvement can be diagnosed and resolved by the editorial team themselves.

### 2. AI-Assisted Admin Checklist Evaluation

Every manuscript passes through an admin checklist before it reaches an editor. In traditional systems this is entirely manual — an assistant editor opens each submission and ticks boxes. In this system, Claude evaluates each item automatically when the manuscript is submitted.

Checklist items that are unambiguously met (cover letter present, all author affiliations complete) are marked `pass` immediately. Items that require judgment — ethics declarations, figure resolution, conflict-of-interest disclosures — are evaluated by Claude and returned with a status (`pass`, `fail`, or `borderline`) and a plain-language rationale.

**Borderline cases are surfaced for human review**, not silently passed or failed. The assistant editor sees Claude's reasoning inline and can accept it or override with a single click. This preserves human accountability at the triage step while eliminating the mechanical work of reviewing clean submissions.

Once all items are resolved, the assistant editor clicks **Pass to EIC** — which updates the manuscript status and routes it forward in the workflow. The full checklist evaluation and any overrides are written to the history event log, creating an auditable record of who decided what and when.

The checklist questions themselves are admin-configurable per journal (`manuscript.form_fields`) — no code change required to add or remove a checklist item.

### 3. Research Integrity Screening

Academic fraud is accelerating. Papers from suspected paper mills are doubling every 18 months — roughly ten times faster than legitimate publication growth. Image manipulation, fake reviewer networks, AI-generated manuscripts, and organised submission fraud are routine enough that major publishers now screen every submission automatically. This system does the same, as a Claude agent that runs at submission time and produces a structured integrity report alongside the admin checklist.

The agent evaluates a configurable set of signals and flags anything that warrants human attention. No manuscript is blocked automatically — the report is surfaced to the assistant editor as part of the checklist review, with the same confirm-before-action pattern used elsewhere in the system.

**Signals screened:**

| Signal | What is checked |
|---|---|
| **Image integrity** | Figures are scanned for duplication, cloning, splicing, and AI-generated content using image forensics |
| **IP anomalies** | Submitter IP is compared against suggested reviewer IPs, co-author IPs, and known datacenter/VPN ranges — overlap is a paper mill marker |
| **Tortured phrases** | Manuscript text is checked for known paraphrasing patterns (e.g. "bosom malignancy" for "breast cancer") that indicate machine-translated or auto-paraphrased mill output |
| **Reviewer manipulation** | Suggested reviewers are checked: unverifiable institutional emails, non-existent ORCID records, domain registration age, and IP overlap with the submitting author |
| **AI-generated text** | Linguistic patterns inconsistent with the declared authorship or discipline are flagged for editorial attention |
| **ORCID and identity** | Author ORCID records are verified; mismatches between declared affiliation and ORCID history are noted |
| **Citation anomalies** | Unusual self-citation rates, citation rings, or references to retracted or predatory-journal sources |
| **Metadata inconsistencies** | Document creation metadata (author field, creation date, revision history) is checked for contradictions with the submission |

Each signal produces one of three outcomes: **clear**, **note** (for context), or **flag** (warrants editorial review). The overall report is attached to the manuscript record and written to the history event log. Editors can dismiss a flag with a reason, escalate it for further review, or reject the submission outright — all actions are auditable.

The signal set is configurable per journal via `manuscript.journal_settings`. Journals with lower fraud exposure can run a lighter screen; high-volume journals can enable all signals and tune thresholds. Signal results are stored as JSONB in the history event log — no separate schema is needed.

### 4. AI-Assisted Reviewer Selection

An assistant editor triggers the agent, which queries the graph for:
- Reviewers with matching subject area expertise
- Recency of last review assignment (avoid overburdening active reviewers)
- Existing relationships between reviewer and author nodes (detect conflicts of interest)
- Historical acceptance rates and review quality scores

The agent returns a ranked shortlist. The assistant editor confirms or overrides. This closes a loop that currently takes hours of manual cross-referencing.

---

## Navigation Architecture

The system has two public entry points and a set of role-specific workspaces.

### Entry points

**`/` — Generic landing page.** Represents the publisher or society. Shows role-based "centers" (Author Center, Reviewer Center, Editorial Center) that are not journal-specific. Clicking a center prompts login, then routes to the correct journal workspace based on the user's roles.

**`/journal/[acronym]` — Per-journal landing page.** Each journal has its own landing page (e.g. `/journal/NEJM`) with centers scoped to that journal. Login from here routes directly to that journal — no journal selection step.

### Post-login routing

| Role | Destination |
|---|---|
| `author` | `/author/[acronym]` |
| `reviewer` | `/reviewer/[acronym]` |
| `assistant_editor`, `editor`, `editor_in_chief`, `editorial_support` | `/journal-admin/[acronym]` |
| `system_admin` | `/admin` |

Users with the same role on multiple journals are shown a journal picker during login. Users with exactly one journal are routed directly. Once inside a workspace, a journal selector in the header allows switching between journals without returning to the landing page.

---

## Admin Architecture

Two levels of administration with distinct scopes:

### System Admin (`/admin`)
Manages the installation as a whole. Accessible only to `system_admin` role.
- **Journals** — add journals, set acronym, disable journals (stop accepting new submissions)
- System-level settings

### Journal Workspace (`/journal-admin/[acronym]`)
The editorial office for a specific journal. Accessible to editors and journal-level admins. All data is scoped to the current journal. Sections:
- **Dashboard** — queue counts and at-a-glance status
- **Checklist Queue** — newly submitted manuscripts awaiting admin review
- **Manuscript Types** — submission types (Original Research, Review Article, etc.) with acronyms and workflow links
- **Workflows** — workflow definitions rendered as linear step lists
- **Workflow Config** — AI chat interface for configuring workflows in plain language
- **Email Templates** — reusable email templates attached to workflow communication steps
- **Users** — people with roles on this journal
- **Troubleshooting** — AI chat for diagnosing stuck manuscripts and stalled gates

---

## Admin-Configurable Settings

Journal administrators can configure many aspects of the system without code changes. Settings use different storage strategies depending on their nature:

| Type | Storage | Admin UI |
|---|---|---|
| Ordered questions / form fields (checklists, submission forms, signup fields) | `manuscript.form_fields` relational table | Drag-to-reorder CRUD panel |
| Scalar journal config (deadline defaults, reviewer counts, feature flags) | `manuscript.journal_settings` key-value table | Settings form |
| Workflow-conditional checks | Graph gate nodes | Workflow Config chat |

*These admin-configurable setting pages are planned but not yet built.*

---

## Theming

All colors, radius, and surface tokens are CSS custom properties in `app/globals.css`. Change them once and the entire app rethemes — light and dark mode both update.

1. Open the [Shadcn theme builder](https://ui.shadcn.com/create) and design your theme visually
2. Copy the `--preset` code shown at the bottom left
3. Run: `npx shadcn@latest init --preset <code>`

---

## Stack

**TRAINS** — Tailwind · React · AI · Next.js · Shadcn

| Letter | Technology | Version |
|--------|-----------|---------|
| **T** | [Tailwind CSS](https://tailwindcss.com) | v4 |
| **R** | [React](https://react.dev) | v19 |
| **AI** | [Claude (Anthropic)](https://docs.anthropic.com) | claude-opus-4-6 |
| **N** | [Next.js](https://nextjs.org) | v16 (App Router) |
| **S** | [Shadcn/ui](https://ui.shadcn.com) | v4 |

**Auth:** [Better Auth](https://better-auth.com) (MIT) — self-hosted, TypeScript-first authentication with email/password and OAuth support. No external auth service required. Better Auth is the default for smaller organisations. Larger organisations that integrate a different auth provider (SSO/SAML, enterprise IdP) must release that code under AGPLv3.

**Graph + Relational DB:** [PostgreSQL](https://www.postgresql.org) + [Apache AGE](https://age.apache.org) extension (Cypher query support over Postgres). Apache 2.0 licensed — the only viable path given that Neo4j, ArangoDB, FalkorDB, and Memgraph all now use SaaS-restricting licenses incompatible with AGPLv3 SaaS hosting without a commercial agreement.

**Object Storage:** [MinIO](https://min.io) (S3-compatible, AGPLv3) for binary files — manuscripts, figures, reviewer attachments. Operators can swap in any S3-compatible service with no code changes.

---

## License

[GNU Affero General Public License v3.0 (AGPLv3)](LICENSE)

This license was chosen deliberately. Editorial management systems are delivered as SaaS. AGPLv3 requires that any hosted version of this software — including hosted forks — make their source code available. This prevents the system from being commercialized into a closed product, which is exactly the problem this project is trying to solve.

---

## What's Built

### Infrastructure
- **Docker Compose stack** — `apache/age` (PostgreSQL + AGE extension) on port 5432, MinIO on ports 9000/9001, both with persistent volumes and healthchecks
- **Database schemas** — `manuscript` schema (journals, people, roles, manuscripts, manuscript types, assignments), `history` schema (append-only event log), AGE property graph (`ems_graph`)
- **Migrations** — `db/init.sql` (base schema), `db/002_manuscript_types.sql` (manuscript types table), `db/003_journal_acronym.sql` (journal acronym column — unique, required, URL slug), `db/004_credit.sql` (CRediT contributor roles + `journal_settings` table)
- **Seed data** — test journal, people with roles, manuscript, graph nodes mirroring relational data (`db/seed.sql`, `db/seed_full.sql`)
- **`lib/graph.ts`** — database client with `sql()` for parameterised SQL, `cypher()` for graph queries, `cypherMutate()` for graph writes, and `withTransaction()` for multi-step operations

### System Admin (`/admin`)
- **Landing page** — links to all system-level sections
- **Journals** — add and edit journals with name, acronym (required, unique, URL slug), ISSN, and subject area

### Journal Workspace (`/journal-admin/[acronym]`)
All pages are scoped to the journal identified by acronym in the URL. A journal selector in the header allows switching between journals.
- **Dashboard** — queue counts (awaiting checklist, under review, awaiting revision) with action links
- **Checklist Queue** — list of submitted manuscripts awaiting admin review, with AI evaluation status badges
- **Manuscript detail** — full manuscript metadata, AI-powered admin checklist evaluation, override controls, and action buttons (Pass to EIC, Unsubmit, Reject with Transfer)
- **Manuscript Types** — per-journal submission types with acronym, description, workflow link, active/inactive status
- **Workflows** — workflow definitions filtered to this journal, rendered as numbered linear step lists with gate branching shown inline
- **Workflow Config** — AI chat for configuring workflows in plain language (confirm-before-commit)
- **Email Templates** — `EmailTemplate` graph nodes with name, subject, description, body
- **Users** — people with roles on this journal; add and edit with role checkboxes
- **Troubleshooting** — AI chat for diagnosing and fixing stuck manuscripts and stalled gates

### AI Interfaces
**General chat** (`/api/chat`) — streaming Claude chat on the home page, no tools, for general questions.

**Workflow agent** (`/api/admin/workflow-chat`) — tool-using Claude agent with nine tools across two modes:
- *Configuration:* `get_workflow`, `describe_workflow`, `list_gate_types`, `list_email_templates`, `stage_mutations`, `commit_mutations`
- *Troubleshooting:* `query_manuscripts`, `get_manuscript_details`, `get_manuscript_history`

Confirm-before-commit applies to both modes. A Standard Peer Review workflow (5 steps, 1 gate with `ON_PASS`/`ON_TIMEOUT` branches) has been configured and committed via chat.

### Planned (not yet built)
- **Authentication** (Better Auth) — login/logout, session management, email verification, password reset; `auth_user_id` FK linking Better Auth users to `manuscript.people`
- **Role-based login routing** — post-login redirect based on editorial role and journal; journal picker for users with multiple journals
- **Per-journal landing pages** (`/journal/[acronym]`)
- **Author portal** (`/author/[acronym]`)
- **Reviewer portal** (`/reviewer/[acronym]`)
- **Admin-configurable form fields and journal settings** — checklist questions, submission form fields, scalar journal config
- **CRediT attribution UI** — per-author role selection in the submission form and display on published articles (enabled per journal via `credit_taxonomy_enabled` journal setting)
- **Research Integrity Screening agent** — per-submission fraud signal report (image forensics, IP anomalies, tortured phrases, reviewer manipulation, AI-generated text, ORCID verification, citation anomalies, metadata checks); signal set configurable per journal via `journal_settings`
- **Reviewer selection agent**

---

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── chat/route.ts                         # General Claude streaming chat (no tools)
│   │   ├── admin/
│   │   │   ├── workflow-chat/route.ts             # Workflow config agent (6 tools, NDJSON stream)
│   │   │   └── troubleshooting-chat/route.ts      # Troubleshooting agent (3 tools, NDJSON stream)
│   │   └── journal-admin/
│   │       └── checklist-evaluate/route.ts        # AI checklist evaluation endpoint
│   ├── admin/
│   │   ├── layout.tsx                             # System admin shell (Journals only)
│   │   ├── page.tsx                               # System admin landing
│   │   └── journals/                              # Add / edit journals
│   ├── journal-admin/
│   │   └── [acronym]/
│   │       ├── layout.tsx                         # Journal workspace shell + journal selector
│   │       ├── journal-selector.tsx               # Client component — journal switcher dropdown
│   │       ├── page.tsx                           # Dashboard (journal-scoped queue counts)
│   │       ├── queue/page.tsx                     # Checklist queue
│   │       ├── manuscripts/[id]/                  # Manuscript detail, checklist, actions
│   │       ├── manuscript-types/                  # Submission types CRUD
│   │       ├── workflows/page.tsx                 # Workflow definitions list
│   │       ├── workflow/page.tsx                  # AI workflow configuration chat
│   │       ├── email-templates/                   # Email template CRUD
│   │       ├── users/                             # Journal users CRUD
│   │       └── troubleshooting/page.tsx           # AI troubleshooting chat
│   ├── globals.css                                # Tailwind v4 global styles + theme tokens
│   ├── layout.tsx                                 # Root layout
│   └── page.tsx                                   # Home / generic landing page
├── components/
│   ├── chat.tsx                                   # General chat UI
│   ├── workflow-chat.tsx                          # Workflow/troubleshooting chat with tool badges
│   └── ui/                                        # Shadcn components (owned, editable)
├── db/
│   ├── init.sql                                   # AGE extension, graph, all schemas and tables
│   ├── migrate.sh                                 # Runs init.sql against running container
│   ├── 002_manuscript_types.sql / .sh             # Migration: manuscript types table
│   ├── 003_journal_acronym.sql / .sh              # Migration: journal acronym column (UNIQUE NOT NULL)
│   ├── seed.sql / seed.sh                         # Minimal test data
│   └── seed_full.sql / seed_full.sh               # Full test dataset
├── lib/
│   ├── graph.ts                                   # sql(), cypher(), cypherMutate(), withTransaction()
│   ├── credit.ts                                  # CRediT Contributor Role Taxonomy — 14 roles, slugs, degree options
│   └── utils.ts                                   # cn() helper (tailwind-merge + clsx)
├── docker-compose.yml                             # postgres-age + minio services
├── CLAUDE.md                                      # Claude Code project guide (architecture decisions)
├── components.json                                # Shadcn configuration
└── next.config.ts                                 # Next.js configuration
```

---

## Installation

Installation is designed to be guided by a Claude agent. Open `INSTALL.md` in Claude Code and follow the prompts — the document is written for an AI agent to execute, with exact commands, environment variable templates, and verification steps after each step.

### Quick start (development)

```bash
# 1. Clone and install dependencies
npm install

# 2. Copy environment template and fill in your ANTHROPIC_API_KEY
cp .env.example .env.local

# 3. Start the database and object storage
docker compose up -d

# 4. Run database migrations (creates schemas and the AGE graph)
bash db/migrate.sh

# 5. (Optional) Load seed data — one test journal, team, and manuscript
bash db/seed.sh

# 6. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Deployment targets

Most managed Postgres services (AWS RDS, Supabase, Aiven) do not support the Apache AGE extension and cannot be used. Only two managed database services support AGE:

| Tier | Database | App | Storage | Best for |
|---|---|---|---|---|
| **1 — Recommended** | Railway (AGE one-click template) | Railway (Docker container) | Cloudflare R2 or AWS S3 | Small editorial offices; no server management |
| **2 — Enterprise** | Azure PostgreSQL Flexible Server (AGE fully managed) | Azure Container Apps | Azure Blob or S3 | Institutions needing HA, backups, PITR |
| **3 — AWS** | Elastic Beanstalk container (apache/age image) | Elastic Beanstalk | AWS S3 | Teams already in the AWS ecosystem |
| **4 — Self-hosted** | Docker Compose (apache/age image + MinIO) | Docker Compose | MinIO or any S3 | Technical teams, lowest cost |

**Why not Vercel?** Agentic Claude tasks can run longer than Vercel's 60-second serverless timeout. All deployment tiers use persistent containers for the app layer.

**Why not AWS RDS?** RDS does not support Apache AGE. Postgres must run in a container on AWS (Tiers 3 and 4).

---

## MCP Servers

Configured in `.mcp.json`:

- [Shadcn MCP Server](https://github.com/ahonn/mcp-server-shadcn) — Claude can browse and add Shadcn components directly
- [Context7 MCP](https://github.com/upstash/context7) — Fetches up-to-date docs for Next.js, React, Tailwind, and Shadcn on demand
- [Puppeteer MCP Server](https://github.com/merajmehrabi/puppeteer-mcp-server) — Claude can navigate the running app and verify features end-to-end
- [Postgres MCP](https://github.com/modelcontextprotocol/servers/tree/main/src/postgres) — Claude can query the workflow graph and manuscript history directly via Cypher (through AGE) and SQL

---

## Tech References

- [Next.js Docs](https://nextjs.org/docs)
- [React Docs](https://react.dev)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Shadcn/ui Components](https://ui.shadcn.com/docs/components)
- [Anthropic API Docs](https://docs.anthropic.com)
- [Apache AGE Docs](https://age.apache.org/age-manual/master/index.html)
- [Better Auth Docs](https://better-auth.com/docs)
- [Lucide Icons](https://lucide.dev)
