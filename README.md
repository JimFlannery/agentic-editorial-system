# AgenticES — The Agentic Editorial System

An open-source agentic editorial management system for academic and scientific publishing, built on a graph database workflow engine and the TRAINS (Tailwind, React, AI, Next.js, Shadcn) stack. Licensed under [AGPLv3](LICENSE).

> **Status:** Active development — full editorial system live including authentication, author portal, reviewer portal, all editorial role dashboards (Assistant Editor, Editor, Editor-in-Chief, Editorial Support), AI-assisted admin checklist, workflow configuration chat, graph visualisation, and multi-journal tenancy. Playwright E2E suite, Puppeteer smoke + screenshot tests, and GitHub Actions CI pipeline in place.

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

### Multi-Journal Support

One installation hosts multiple journals. Each journal has its own editorial team, reviewer pool, workflow definitions, manuscript queue, and configurable settings. Roles are journal-scoped — a person can be an editor on one journal and a reviewer on another. Each journal has a globally unique acronym that serves as its URL slug throughout the system.

---

## Agentic AI Integration

Because the workflow is a graph, AI agents can traverse and act on it naturally. Four core agentic features are planned.

### 1. AI-Assisted Workflow Configuration and Troubleshooting

The graph model solves the vendor lock-in problem — but only if administrators can actually author and modify workflow graphs. Editors migrating from ScholarOne or Editorial Manager are domain experts, not graph database engineers. The raw graph should not be the default interface.

Both the system admin panel and the journal admin panel include a **Claude chat interface** that operates in two modes.

**Workflow configuration:** An administrator describes their workflow in plain language:

> *"We need three reviewers for a research article. If all three submit within 21 days, the editor is notified. If one is late, send them a reminder and give a 7-day extension. If two are late after the extension, escalate to the Editor-in-Chief."*

Claude translates this into graph mutations — creating Gate nodes, setting thresholds, wiring outcome relationships — and then renders a **linear visual of the resulting workflow** back to the administrator for confirmation before committing. The visual is the primary feedback loop; the graph itself is accessible as a read-only view for power admins but not the default.

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

Journal is the primary organiser. Every route below system admin is nested under `/journal/[acronym]/`, which makes per-journal theming, custom domains, and bookmarkable URLs natural consequences of the structure rather than afterthoughts.

### Entry points

**`/` — Platform landing page.** Lists all hosted journals as cards. Clicking a journal enters its workspace at `/journal/[acronym]`. No role-center navigation here — journal is the organising concept, not role.

**`/journal/[acronym]` — Journal workspace root.** All activity for a journal is nested here. The layout at this level injects per-journal CSS custom properties so each journal can carry its own visual identity.

**Custom domain (e.g. `AgenticES.NEJM.com`).** A journal's editorial system can be served from a subdomain of the journal's own domain. The infrastructure layer (nginx or Cloudflare) injects `X-Journal-Acronym: NEJM` into the request; `proxy.ts` rewrites transparently to `/journal/NEJM/...`. The visitor's URL stays as the custom domain.

### Post-login routing

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

Users with the same role on multiple journals are shown a journal picker during login. Users with exactly one journal are routed directly.

### Header controls (editorial workspace)

The editorial workspace header contains two switchers:

- **Journal selector** — switches between all journals the user has access to, routing to `/journal/[newAcronym]/editorial`
- **Role selector** — jumps between all role centers for the current journal (Author, Reviewer, Assistant Editor, Editor, Editor-in-Chief, Editorial Support) without going back to the landing page

### Role-specific dashboards

All four editorial roles share the `/journal/[acronym]/editorial` layout (sidebar nav, journal selector, role selector) but land on role-tailored dashboard pages:

| URL | Audience | Purpose |
|---|---|---|
| `/journal/[acronym]/editorial/assistant-editor` | Assistant Editors | Submission intake, admin checklist, reviewer invitations |
| `/journal/[acronym]/editorial/editor` | Editors | Reviewer reports, accept/reject/revise decisions |
| `/journal/[acronym]/editorial/editor-in-chief` | Editor-in-Chief | Editorial oversight, escalations, final decisions, board management |
| `/journal/[acronym]/editorial/editorial-support` | Editorial Support | Author correspondence, administrative tasks |

The Checklist Queue and manuscript detail pages are shared across editorial roles, accessible from the sidebar. The role dashboard is the default landing only.

---

## Admin Architecture

Three levels with distinct scopes and audiences.

### System Admin (`/admin`)

Accessible only to `system_admin` users. This is where an installation is initially configured — typically by one technical person or editorial expert at a large organisation who sets everything up before handing off journal-level configuration to editorial offices.

The system admin has the full toolkit:
- **Journals** — add journals, set acronym, disable journals (stop accepting new submissions)
- **Users** — manage system-level users and their journal assignments
- **Manuscript Types** — define submission types available across journals
- **Email Templates** — reusable templates for workflow communication steps
- **Workflows** — view all workflow definitions across all journals
- **Workflow Config** — Claude chat interface for creating and modifying workflows in plain language, with confirm-before-commit
- **Troubleshooting** — Claude chat for diagnosing and fixing stuck manuscripts, stalled gates, or misconfigured workflows across any journal
- **Graph View** — read-only sigma.js/graphology visualisation of the full workflow graph; click any node to inspect its properties

**Only Claude writes to the graph.** The Graph View is intentionally read-only. Editing the property graph directly requires graph database expertise that 99.9% of users will not have — exposing raw graph editing would guarantee corrupted workflows. Claude is the translation layer between plain-language intent and graph mutations.

### Editorial Workspace (`/journal/[acronym]/editorial`)

The day-to-day working area for all editorial roles. Scoped to one journal at a time. Sections:
- **Role dashboards** — tailored landing pages for Assistant Editor, Editor, Editor-in-Chief, and Editorial Support
- **Checklist Queue** — newly submitted manuscripts awaiting admin review
- **Manuscript detail** — full metadata, AI-powered checklist evaluation, override controls, and action buttons (Pass to EIC, Unsubmit, Reject with Transfer)

### Journal Admin (`/journal/[acronym]/admin`)

Configuration workspace for a specific journal, separate from the editorial workflow. Editors work manuscripts in `/editorial`; journal admins configure the journal in `/admin`. This is where editorial offices make ongoing changes after initial setup. Sections:
- **Dashboard** — journal configuration at a glance
- **Manuscript Types** — per-journal submission types with acronym, description, workflow link, active/inactive status
- **Workflows** — workflow definitions for this journal, rendered as numbered linear step lists with gate branching shown inline
- **Workflow Config** — Claude chat for modifying workflows in plain language, scoped to this journal (confirm-before-commit)
- **Email Templates** — `EmailTemplate` graph nodes for this journal
- **Users** — people with roles on this journal; add and edit with role checkboxes
- **Troubleshooting** — Claude chat for diagnosing and fixing issues scoped to this journal

---

## Admin-Configurable Settings

Journal administrators can configure many aspects of the system without code changes. Settings use different storage strategies depending on their nature:

| Type | Storage | Admin UI |
|---|---|---|
| Ordered questions / form fields (checklists, submission forms, signup fields) | `manuscript.form_fields` relational table | Drag-to-reorder CRUD panel |
| Scalar journal config (deadline defaults, reviewer counts, feature flags) | `manuscript.journal_settings` key-value table | Settings form |
| Workflow-conditional checks | Graph gate nodes | Workflow Config chat |

*Admin-configurable form fields and journal settings pages are planned but not yet built.*

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
- **Database schemas** — `manuscript` schema (journals, people, roles, manuscripts, manuscript types, assignments, multi-author support), `history` schema (append-only event log), AGE property graph (`ems_graph`)
- **Migrations** — `db/init.sql` (base schema) through `db/010_tracking_number.sql` (per-journal/year sequence + helper function for ScholarOne-style manuscript IDs); migration tracking via `schema_migrations` table; `db/migrate.sh` is idempotent and skips already-applied migrations
- **Seed data** — `db/seed_test.sql` — TEST journal with 10 users across all roles, 8 manuscripts in every workflow state; `db/seed.sql` / `db/seed_full.sql` for development. **`db/seed_workflow.sql` / `db/clear_workflow.sql`** — idempotent graph-workflow seed/clear pair used to toggle the pipeline view between graph-driven and enum-fallback modes for testing
- **`lib/graph.ts`** — database client with `sql()` for parameterised SQL, `cypher()` for graph queries, `cypherMutate()` for graph writes, and `withTransaction()` for multi-step operations
- **Object storage** — MinIO for self-hosted; swap to any S3-compatible service via environment variables

### Authentication & Routing
- **Better Auth** — email/password login, session management, password reset; scrypt-based password hashing; `auth_user_id` FK linking auth users to `manuscript.people`
- **Role-based routing** — post-login redirect based on editorial role and journal; journal picker for users with roles on multiple journals
- **`lib/auth-helpers.ts`** — `requireRole()` for server-side access control on all protected pages

### Manuscript Identification
- **ScholarOne-style tracking numbers** — every manuscript gets a stable, human-readable ID of the form `ACRONYM-YYYY-NNNNN` (e.g. `TEST-2026-00003`), with revisions appended as `.R1`, `.R2`, etc. Allocated atomically by the `manuscript.next_tracking_number(journal_id)` Postgres function backed by a per-`(journal, year)` counter table; the year resets each January and the 5-digit zero-pad supports up to 99,999 submissions per journal per year before the digit count grows. `lib/tracking.ts` exports `formatTrackingNumber()` for consistent display. Tracking numbers appear in every list (author center, reviewer center, editorial queue, pipeline, all editorial dashboards) and at the top of every manuscript detail page

### Author Portal (`/journal/[acronym]/author`)
- **Manuscript list** — paginated list of the author's submissions with tracking number, status badges; links to per-manuscript detail
- **Submission form** — title, abstract, manuscript type, multiple co-authors (CRediT roles), file upload to MinIO/S3; tracking number allocated at submission time
- **Manuscript detail** — full metadata, activity timeline, file download, revision submission (revision_number auto-increments)

### Reviewer Portal (`/journal/[acronym]/reviewer`)
- **Assignment dashboard** — stat cards (pending invitations, in progress, completed), full assignment list with due dates and status badges
- **Manuscript detail** — manuscript title, abstract, invitation status, accept/decline buttons, review submission form

### System Admin (`/admin`)
- **Landing page** — cards linking to all system-level sections
- **Journals** — add and edit journals with name, acronym (required, unique, URL slug), ISSN, and subject area
- **Users** — system-level user management with journal and role assignments
- **Manuscript Types** — submission type definitions with acronym, description, workflow link, active/inactive toggle
- **Email Templates** — `EmailTemplate` graph nodes with name, subject, description, body
- **Workflows** — all workflow definitions across all journals, rendered as linear step lists with gate branching
- **Workflow Config** — Claude chat for creating and modifying any journal's workflows in plain language (confirm-before-commit)
- **Troubleshooting** — Claude chat for diagnosing and fixing issues across any journal
- **Graph View** — read-only sigma.js + graphology visualisation of the full workflow graph with ForceAtlas2 layout; click any node to inspect its properties in a side panel; colour-coded by node type

### Editorial Workspace (`/journal/[acronym]/editorial`)
The day-to-day working area for all editorial roles. Journal selector and role selector in the header. All pages are scoped to the journal identified by acronym in the URL.
- **Manuscript Pipeline** — graph-driven oversight view for EICs and editorial offices. Horizontal pipeline strip across the top shows every workflow stage with its count and a stalled-count indicator (>14 days no activity); clicking a tile filters the manuscript table below. Stages, ordering, labels, and which states are terminal all come from the property graph (`WorkflowDefinition` → `Step` nodes with `position`, `status`, `terminal` properties). When no workflow exists for a journal, the page falls back to the relational `manuscript.status` enum with an inline notice linking to the workflow config chat. Fully accessible: real `<table>` markup with `<th scope>`, `aria-pressed` on filter tiles, screen-reader text alternatives for stalled indicators, no colour-only meaning, URL-driven filters (no client JS state)
- **Assistant Editor dashboard** — live queue counts, checklist intake, reviewer invitation management
- **Editor dashboard** — reviewer reports, accept/reject/revise decisions
- **Editor-in-Chief dashboard** — stat cards, stalled manuscripts widget, monthly metrics, recent decisions
- **Editorial Support dashboard** — author correspondence, administrative tasks
- **Checklist Queue** — list of submitted manuscripts awaiting admin review, with AI evaluation status badges
- **Manuscript detail** — full manuscript metadata, AI-powered admin checklist evaluation, override controls, and action buttons (Pass to EIC, Unsubmit, Reject with Transfer)

### Journal Admin (`/journal/[acronym]/admin`)
Configuration workspace, separate from the editorial workflow. Header links back to the editorial workspace.
- **Dashboard** — journal configuration at a glance
- **Manuscript Types** — per-journal submission types with acronym, description, workflow link, active/inactive status
- **Workflows** — workflow definitions for this journal, rendered as numbered linear step lists with gate branching shown inline
- **Workflow Config** — Claude chat for modifying this journal's workflows in plain language (confirm-before-commit)
- **Email Templates** — `EmailTemplate` graph nodes with name, subject, description, body
- **Users** — people with roles on this journal; add and edit with role checkboxes
- **Troubleshooting** — Claude chat for diagnosing and fixing issues scoped to this journal

### AI Interfaces
**General chat** (`/api/chat`) — streaming Claude chat on the home page, no tools, for general questions.

**Workflow agent** (`/api/admin/workflow-chat`) — tool-using Claude agent with nine tools across two modes:
- *Configuration:* `get_workflow`, `describe_workflow`, `list_gate_types`, `list_email_templates`, `stage_mutations`, `commit_mutations`
- *Troubleshooting:* `query_manuscripts`, `get_manuscript_details`, `get_manuscript_history`

Confirm-before-commit applies to both modes. A Standard Peer Review workflow (5 steps, 1 gate with `ON_PASS`/`ON_TIMEOUT` branches) has been configured and committed via chat.

**Help guide panel** (`/api/help`) — context-aware slide-over panel (Shadcn `Sheet`) available in every layout header. Serves the correct markdown user guide based on the current route (reviewer guide on reviewer pages, AE guide on editorial pages, etc.) and renders it as styled HTML. Triggered by the `?` button in the top bar.

### Branding & Theming
- **AgenticES wordmark** — "Agentic*ES*" logo mark (italic indigo *ES*) in every layout header, the home page hero, login page, and footer; links back to `/`
- **Full semantic token refactor** — all 52 page and component files use Shadcn semantic tokens (`bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-card`, `bg-muted`, etc.) instead of hardcoded zinc classes. Journal operators can apply any Shadcn theme and the entire UI rethemes — colors, radius, and typography — without code changes.

### Test Infrastructure
- **`db/seed_test.sql`** — deterministic TEST journal seed: 10 users (all roles), 8 manuscripts covering every workflow status, reviewer assignments on both accepted and under-review manuscripts
- **Playwright E2E** (`tests/e2e/`) — auth setup (storageState per role) + author, queue, manuscript-detail, EIC, and reviewer spec files; 28 tests
- **Puppeteer smoke + screenshot tests** (`tests/puppeteer/`) — 9 smoke tests (all pages HTTP 200) + 7 screenshot captures; `npm run test:puppeteer`
- **GitHub Actions CI** (`.github/workflows/ci.yml`) — runs on every PR and push to main: migrate, seed TEST, build, Playwright, Puppeteer, upload report artifact
- **Manual testing procedures** ([docs/testing.md](docs/testing.md)) — documents test paths that are easy to regress and not covered by automated tests. First procedure: toggling the Manuscript Pipeline page between graph-driven and enum-fallback modes via `db/seed_workflow.sql` / `db/clear_workflow.sql`. Each procedure shows commands in both bash (`<` redirect) and PowerShell (`Get-Content | …`) forms

### Accessibility
- **WCAG 2.1 AA as the project baseline** — codified in [CLAUDE.md](CLAUDE.md). Every UI change is held to: semantic HTML over `<div onClick>`, programmatic labels on every form control, visible focus rings, 4.5:1 contrast in light and dark modes (including admin-set per-journal theme colours), no colour-only meaning, real `<table>` markup for tabular data, alt text and ARIA live regions for async actions, `prefers-reduced-motion` respect, and tagged PDFs for system-generated documents. Verification: automated checks (axe-core / Lighthouse / `eslint-plugin-jsx-a11y`), manual keyboard tab-through, 200% zoom + 320 px width, occasional screen-reader sanity checks. Required because many target operators (public universities, federally-funded institutions, learned societies) are subject to Section 508, the ADA, and equivalent obligations

### Planned (not yet built)
- **Admin-configurable form fields** — drag-to-reorder checklist questions and submission form fields per journal (`manuscript.form_fields`)
- **In-app notification feed** — editorial staff notification panel in the header (manuscript assigned, review submitted, decision sent)
- **Research Integrity Screening agent** — per-submission fraud signal report. Implemented as a two-tier system: (1) a **separate MCP server repo** (`oss-ris-mcp`) that builds versioned definition files (retracted authors/DOIs, hijacked journals, paper mill phrase lists, fraud taxonomy) from sources including the Retraction Watch/Crossref dataset, refreshed on each MCP server release; and (2) live MCP tools for computational checks (IP reputation and geolocation vs. affiliation, email domain/disposable address detection, ORCID verification, GRIM/SPRITE statistical tests, citation retraction batch lookup). AgenticES pins to a definition file version and calls the MCP tools at screening time; the two repos have independent contributor bases. Architecture is documented but not yet built — non-trivial.
- **Reviewer selection agent** — ranked shortlist with conflict-of-interest detection
- **Mobile phone support** — responsive layouts for authors and reviewers; no separate app or routes. Authors can check submission status and read decision letters on mobile; reviewers can accept/decline invitations and view assignment deadlines. Long-form actions (file upload, writing a review, editorial decisions, checklist evaluation, all admin pages) show a "desktop required" affordance. Editorial staff get read-only queue stats and manuscript lists on mobile. Build order: reviewer invitation response first (most time-sensitive), then author status dashboard, reviewer assignment list, editorial dashboard stats, and finally mobile nav patterns.

---

## Project Structure

Full file tree is in [docs/contributing.md](docs/contributing.md). Key locations:

```
├── proxy.ts                                           # Custom domain → /journal/[acronym] rewrite
├── docker-compose.yml                                 # postgres-age + minio services
├── playwright.config.ts                               # Playwright E2E config — 5 projects, storageState auth
├── jest.config.ts                                     # Jest config for Puppeteer tests
├── app/
│   ├── globals.css                                    # Tailwind v4 global styles + theme tokens
│   ├── layout.tsx                                     # Root layout
│   ├── page.tsx                                       # Platform landing — journal grid + features
│   ├── login/page.tsx                                 # Better Auth login page
│   ├── api/
│   │   ├── auth/[...all]/route.ts                     # Better Auth catch-all handler
│   │   ├── chat/route.ts                              # General Claude streaming chat (no tools)
│   │   ├── admin/
│   │   │   ├── workflow-chat/route.ts                 # Workflow config + troubleshooting agent
│   │   │   └── troubleshooting-chat/route.ts          # Troubleshooting agent (3 tools, NDJSON stream)
│   │   └── journal-admin/
│   │       └── checklist-evaluate/route.ts            # AI checklist evaluation endpoint
│   ├── admin/                                         # System admin — initial setup, all journals
│   │   ├── layout.tsx                                 # System admin shell + full sidebar nav
│   │   ├── page.tsx                                   # System admin landing — section cards
│   │   ├── journals/                                  # Add / edit journals
│   │   ├── users/                                     # System-level user management
│   │   ├── manuscript-types/                          # Submission type definitions
│   │   ├── email-templates/                           # Email template CRUD
│   │   ├── workflows/page.tsx                         # All workflow definitions (read)
│   │   ├── workflow/page.tsx                          # Claude workflow config chat
│   │   ├── troubleshooting/page.tsx                   # Claude troubleshooting chat
│   │   └── graph/page.tsx                             # Read-only graph visualisation
│   └── journal/
│       ├── page.tsx                                   # Redirects to first journal (or /admin/journals)
│       └── [acronym]/
│           ├── layout.tsx                             # Theming wrapper — injects per-journal CSS vars
│           ├── page.tsx                               # Journal landing — role center cards
│           ├── author/
│           │   ├── page.tsx                           # Author portal — submission list, pagination
│           │   ├── manuscripts/[id]/page.tsx          # Author manuscript detail + activity timeline
│           │   ├── submit/page.tsx                    # Submission form — title, abstract, files, co-authors
│           │   └── journal-selector.tsx               # Author-scoped journal switcher
│           ├── reviewer/
│           │   ├── page.tsx                           # Reviewer portal — assignment list, stats
│           │   ├── manuscripts/[id]/page.tsx          # Reviewer manuscript detail — accept/decline/review
│           │   └── journal-selector.tsx               # Reviewer-scoped journal switcher
│           ├── editorial/
│           │   ├── layout.tsx                         # Editorial workspace shell + journal/role selectors
│           │   ├── journal-selector.tsx               # Journal switcher dropdown
│           │   ├── role-selector.tsx                  # Role switcher dropdown
│           │   ├── page.tsx                           # Redirects to role dashboard (post-auth)
│           │   ├── assistant-editor/page.tsx          # AE dashboard — queue counts, checklist intake
│           │   ├── editor/page.tsx                    # Editor dashboard — decisions, reviewer reports
│           │   ├── editor-in-chief/page.tsx           # EIC dashboard — stats, stalled, recent decisions
│           │   ├── editorial-support/page.tsx         # Support dashboard — correspondence, admin tasks
│           │   ├── queue/page.tsx                     # Checklist queue (shared across roles)
│           │   └── manuscripts/[id]/                  # Manuscript detail, AI checklist, actions
│           └── admin/                                 # Journal admin — per-journal config
│               ├── layout.tsx                         # Journal admin shell + journal selector
│               ├── journal-selector.tsx               # Journal switcher dropdown
│               ├── page.tsx                           # Journal admin dashboard
│               ├── manuscript-types/                  # Per-journal submission types CRUD
│               ├── workflows/page.tsx                 # This journal's workflow definitions
│               ├── workflow/page.tsx                  # Claude workflow config chat (journal-scoped)
│               ├── email-templates/                   # Email template CRUD
│               ├── users/                             # Journal users CRUD
│               └── troubleshooting/page.tsx           # Claude troubleshooting chat (journal-scoped)
├── components/
│   ├── chat.tsx                                       # General chat UI
│   ├── workflow-chat.tsx                              # Workflow/troubleshooting chat with tool badges
│   ├── graph-viewer.tsx                               # sigma.js + graphology graph visualisation
│   ├── journal-grid.tsx                               # Homepage journal cards
│   ├── journal-picker.tsx                             # Multi-journal picker (post-login)
│   ├── pagination.tsx                                 # Reusable pagination component
│   ├── user-menu.tsx                                  # Header user menu (logout, profile)
│   ├── theme-provider.tsx
│   ├── theme-toggle.tsx                               # Light/dark mode toggle
│   └── ui/                                            # Shadcn components (owned, editable)
├── db/
│   ├── init.sql                                       # AGE extension, graph, all schemas and tables
│   ├── migrate.sh                                     # Idempotent migration runner (schema_migrations table)
│   ├── 002_manuscript_types.sql                       # Migration: manuscript types table
│   ├── 003_journal_acronym.sql                        # Migration: journal acronym (UNIQUE NOT NULL)
│   ├── 004_credit.sql                                 # Migration: CRediT roles + journal_settings
│   ├── 005_assignments.sql                            # Migration: reviewer assignments table
│   ├── 006_history.sql                                # Migration: history event log
│   ├── 007_email.sql                                  # Migration: email queue / outbox
│   ├── 008_file_storage.sql                           # Migration: manuscript file attachments
│   ├── 009_reviews.sql                                # Migration: review submissions
│   ├── 010_revisions.sql                              # Migration: author revisions
│   ├── 011_manuscript_authors.sql                     # Migration: multi-author support
│   ├── 012_better_auth.sql                            # Migration: Better Auth tables (idempotent)
│   ├── seed_test.sql / seed_test.sh                   # TEST journal seed — 10 users, 8 manuscripts
│   ├── seed.sql / seed.sh                             # Minimal dev seed
│   └── seed_full.sql / seed_full.sh                   # Full dev dataset
├── lib/
│   ├── auth.ts                                        # Better Auth instance
│   ├── auth-helpers.ts                                # requireRole() — server-side access control
│   ├── graph.ts                                       # sql(), cypher(), cypherMutate(), withTransaction()
│   ├── credit.ts                                      # CRediT Contributor Role Taxonomy — 14 roles
│   └── utils.ts                                       # cn() helper (tailwind-merge + clsx)
├── tests/
│   ├── e2e/                                           # Playwright E2E tests
│   │   ├── auth.setup.ts                              # Auth setup — storageState for 4 users
│   │   ├── author.spec.ts                             # Author portal — portal, submission form
│   │   ├── queue.spec.ts                              # Checklist queue — loads, links, titles
│   │   ├── manuscript-detail.spec.ts                  # Manuscript detail — metadata, checklist, timeline
│   │   ├── eic.spec.ts                                # EIC dashboard — stats, stalled, decisions
│   │   └── reviewer.spec.ts                           # Reviewer portal — assignments, detail, breadcrumb
│   └── puppeteer/                                     # Puppeteer smoke + screenshot tests
│       ├── helpers.ts                                 # launchBrowser(), loginAs(), assertPageOk()
│       ├── smoke.test.ts                              # 9 smoke tests — all key pages return HTTP 200
│       └── screenshots.test.ts                        # 7 screenshot captures for visual review
├── .github/
│   └── workflows/
│       ├── ci.yml                                     # CI: migrate, seed, build, Playwright, Puppeteer
│       └── release.yml                                # Release: build Docker image → GHCR
├── CLAUDE.md                                          # Claude Code project guide (architecture decisions)
├── components.json                                    # Shadcn configuration
└── next.config.ts                                     # Next.js configuration
```

---

## Documentation

| Document | Audience |
|---|---|
| [docs/deploy/development.md](docs/deploy/development.md) | Developers — local setup with Docker Compose |
| [docs/deploy/railway.md](docs/deploy/railway.md) | Operators — Railway deployment (Tier 1, recommended) |
| [docs/deploy/azure.md](docs/deploy/azure.md) | Operators — Azure deployment (Tier 2, enterprise) |
| [docs/deploy/aws.md](docs/deploy/aws.md) | Operators — AWS Elastic Beanstalk deployment (Tier 3) |
| [docs/deploy/self-hosted.md](docs/deploy/self-hosted.md) | Operators — self-hosted VPS deployment (Tier 4) |
| [docs/deploy/env-reference.md](docs/deploy/env-reference.md) | All deployment targets — full environment variable reference |
| [docs/admin-guide/system-admin.md](docs/admin-guide/system-admin.md) | System administrators — initial setup, workflow configuration, graph view |
| [docs/admin-guide/journal-admin.md](docs/admin-guide/journal-admin.md) | Journal admins — ongoing journal configuration, workflow modification |
| [docs/user-guide/assistant-editor.md](docs/user-guide/assistant-editor.md) | Assistant Editors — checklist queue, reviewer invitations |
| [docs/user-guide/editor.md](docs/user-guide/editor.md) | Editors — reviewer reports, decisions |
| [docs/user-guide/editor-in-chief.md](docs/user-guide/editor-in-chief.md) | Editors-in-Chief — escalations, oversight |
| [docs/user-guide/editorial-support.md](docs/user-guide/editorial-support.md) | Editorial Support — correspondence, administrative tasks |
| [docs/user-guide/author.md](docs/user-guide/author.md) | Authors — submission, revision, decisions |
| [docs/user-guide/reviewer.md](docs/user-guide/reviewer.md) | Reviewers — invitations, submitting reviews |
| [docs/contributing.md](docs/contributing.md) | Contributors — architecture, conventions, PR process |

### Quick start (development)

```bash
git clone https://github.com/your-org/oss-editorial-management-system.git
cd oss-editorial-management-system
npm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
docker compose up -d
bash db/migrate.sh
npm run dev
```

See [docs/deploy/development.md](docs/deploy/development.md) for the full step-by-step guide including seed data and common failure modes.

### Deployment

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
- [Sigma.js Docs](https://www.sigmajs.org)
- [Graphology Docs](https://graphology.github.io)
