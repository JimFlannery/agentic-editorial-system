# Agentic Editorial System

An open-source agentic editorial system for academic and scientific publishing, built on a graph database workflow engine and the TRAINS stack. Licensed under [AGPLv3](LICENSE).

> **Status:** Active development — core stack running, admin console and workflow configuration live

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

One installation hosts multiple journals. Each journal has its own editorial team, reviewer pool, workflow definitions, and manuscript queue. Roles are journal-scoped — a person can be an editor on one journal and a reviewer on another.

---

## Agentic AI Integration

Because the workflow is a graph, AI agents can traverse and act on it naturally. Two core agentic features are planned.

### 1. AI-Assisted Workflow Configuration (Admin Panel)

The graph model solves the vendor lock-in problem — but only if administrators can actually author and modify workflow graphs. Editors migrating from ScholarOne or Editorial Manager are domain experts, not graph database engineers. The raw graph should not be the default interface.

The admin panel includes a **Claude chat interface for workflow configuration**. An administrator describes their workflow in plain language:

> *"We need three reviewers for a research article. If all three submit within 21 days, the editor is notified. If one is late, send them a reminder and give a 7-day extension. If two are late after the extension, escalate to the Editor-in-Chief."*

Claude translates this into graph mutations — creating Gate nodes, setting thresholds, wiring outcome relationships — and then renders a **linear visual of the resulting workflow** back to the administrator for confirmation before committing. The visual is the primary feedback loop; the graph itself is accessible for power admins but not the default view.

This makes the system self-documenting: the workflow description the admin provided *is* the documentation, and the visual confirms the system understood it correctly.

**How it works:**
1. Admin describes desired workflow in the chat
2. Claude generates the Cypher mutations needed and explains each change in plain language
3. A linear workflow diagram is rendered for admin review
4. Admin confirms (or clarifies) — mutations are committed only on confirmation
5. The graph view is available as an advanced option for administrators who want direct visibility

### 2. AI-Assisted Reviewer Selection

An assistant editor triggers the agent, which queries the graph for:
- Reviewers with matching subject area expertise
- Recency of last review assignment (avoid overburdening active reviewers)
- Existing relationships between reviewer and author nodes (detect conflicts of interest)
- Historical acceptance rates and review quality scores

The agent returns a ranked shortlist. The assistant editor confirms or overrides. This closes a loop that currently takes hours of manual cross-referencing.

---

## Theming

All colors, radius, and surface tokens are CSS custom properties in `app/globals.css`. Change them once and the entire app rethemes — light and dark mode both update.

### Recommended workflow

1. Open the [Shadcn theme builder](https://ui.shadcn.com/create) and design your theme visually using the controls (Style, Base Color, Theme, Radius, etc.)
2. Copy the `--preset` code shown at the bottom left of the panel
3. Run the CLI command to apply it to this project:

```bash
npx shadcn@latest init --preset <code>
```

This rewrites the CSS variables in `app/globals.css` to match your chosen theme — light and dark mode both update automatically.

### Key variables

| Variable | Effect |
|---|---|
| `--primary` | Buttons, active states |
| `--background` / `--foreground` | Page background and text |
| `--radius` | All border radii app-wide (one value scales everything) |
| `--muted` / `--accent` | Secondary surfaces, hover states |

You can also browse ready-made presets at [ui.shadcn.com/themes](https://ui.shadcn.com/themes) and copy those instead.

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
- **Database schemas** — `manuscript` schema (journals, people, roles, manuscripts, assignments), `history` schema (append-only event log), AGE property graph (`ems_graph`)
- **Seed data** — one journal, seven people with roles, one manuscript, graph nodes and relationships mirroring the relational data
- **`lib/graph.ts`** — database client with `sql()` for parameterised SQL, `cypher()` for graph queries with RETURN clauses, `cypherMutate()` for graph writes, and `withTransaction()` for multi-step operations

### Admin Console (`/admin`)
- **Landing page** — cards linking to all admin sections
- **Journals** (`/admin/journals`) — list of journals with ISSN and subject area
- **Users** (`/admin/users`) — all people with role tags, across all journals
- **Workflows** (`/admin/workflows`) — all `WorkflowDefinition` nodes with their step lists rendered as a numbered linear view
- **Email Templates** (`/admin/email-templates`) — `EmailTemplate` nodes from the graph
- **Workflow Config** (`/admin/workflow`) — AI chat interface for configuring workflows in plain language (see below)

### AI Workflow Configuration
- **`/api/admin/workflow-chat`** — Claude agent with six tools: `get_workflow`, `describe_workflow`, `list_gate_types`, `list_email_templates`, `stage_mutations`, `commit_mutations`
- **Confirm-before-commit pattern** — Claude stages mutations with plain-language descriptions; a UI panel surfaces a "Confirm & apply" button before anything is written to the graph
- **Verified end-to-end** — a Standard Peer Review workflow (5 steps, 1 gate with `ON_PASS`/`ON_TIMEOUT` branches) was configured via chat and committed to the graph

### Home Page
- Landing page with hero, feature grid, and links to the admin console and workflow config

---

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── chat/route.ts                    # General Claude streaming chat route
│   │   └── admin/workflow-chat/route.ts     # Workflow config agent (6 tools, NDJSON stream)
│   ├── admin/
│   │   ├── layout.tsx                       # Admin sidebar + 1280px shell
│   │   ├── page.tsx                         # Admin landing page
│   │   ├── journals/page.tsx                # Journals list
│   │   ├── users/page.tsx                   # Users + roles list
│   │   ├── workflows/page.tsx               # Workflow definitions list
│   │   ├── workflow/page.tsx                # AI workflow configuration chat
│   │   └── email-templates/page.tsx         # Email templates list
│   ├── globals.css                          # Tailwind v4 global styles
│   ├── layout.tsx                           # Root layout
│   └── page.tsx                             # Home / landing page
├── components/
│   ├── chat.tsx                             # General chat UI component
│   ├── workflow-chat.tsx                    # Workflow config chat with tool badges + staged changes panel
│   └── ui/                                  # Shadcn components (you own these)
├── db/
│   ├── init.sql                             # AGE extension, graph, relational schemas
│   ├── migrate.sh                           # Runs init.sql against the running container
│   ├── seed.sql                             # Test journal, people, manuscript, graph nodes
│   └── seed.sh                             # Runs seed.sql against the running container
├── lib/
│   ├── graph.ts                             # sql(), cypher(), cypherMutate(), withTransaction()
│   └── utils.ts                             # cn() helper (tailwind-merge + clsx)
├── docker-compose.yml                       # postgres-age + minio services
├── CLAUDE.md                                # Claude Code project guide
├── components.json                          # Shadcn configuration
└── next.config.ts                           # Next.js configuration
```

---

## Installation

Installation is designed to be guided by a Claude agent. Open `INSTALL.md` in Claude Code and follow the prompts — the document is written for an AI agent to execute, with exact commands, environment variable templates, and verification steps.

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
- [Postgres MCP](https://github.com/modelcontextprotocol/servers/tree/main/src/postgres) — Claude can query the workflow graph and manuscript history directly via Cypher (through AGE) and SQL. Add this to `.mcp.json` early — it makes iterating on the graph model much faster.

---

## Tech References

- [Next.js Docs](https://nextjs.org/docs)
- [React Docs](https://react.dev)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Shadcn/ui Components](https://ui.shadcn.com/docs/components)
- [Anthropic API Docs](https://docs.anthropic.com)
- [Lucide Icons](https://lucide.dev)
