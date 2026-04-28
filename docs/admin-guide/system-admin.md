# System Admin Guide

The system admin panel (`/admin`) is the initial setup workspace for the entire installation. In a large organisation this is typically one person — a technical or editorially experienced administrator who configures the system before handing individual journals off to journal admins.

Only accounts with `system_admin = true` can access `/admin`. The first admin is created via a one-shot environment variable; subsequent admins are promoted from inside the admin panel.

---

## Contents

1. [Granting system admin access](#1-granting-system-admin-access)
2. [Creating your first journal](#2-creating-your-first-journal)
3. [Setting up users and roles](#3-setting-up-users-and-roles)
4. [Defining manuscript types](#4-defining-manuscript-types)
5. [Creating email templates](#5-creating-email-templates)
6. [Configuring workflows with Claude](#6-configuring-workflows-with-claude)
7. [Reading the graph view](#7-reading-the-graph-view)
8. [Troubleshooting with Claude](#8-troubleshooting-with-claude)
9. [Handing off to journal admins](#9-handing-off-to-journal-admins)

---

## 1. Granting system admin access

There are three ways to create the first system admin, in order of preference.

### Option A — `INITIAL_ADMIN_EMAIL` (recommended)

Before starting the app for the first time, set this in your `.env` (or `.env.local` for local dev):

```
INITIAL_ADMIN_EMAIL=admin@yourjournal.org
```

Then start the app, open the browser, navigate to `/login`, switch to the **Sign up** tab, and register using exactly that email address. You will be auto-promoted to system admin on signup.

This is **one-shot**: once any system admin exists, the variable is inert. Anyone else who later signs up — even with the same email — will be a normal user. You can leave the variable in `.env` or remove it; it has no further effect.

For now, additional system admins are promoted using the same CLI command described in Option B. An in-app promotion UI is planned but not yet built.

### Option B — CLI promotion (recovery hatch)

If you forgot to set `INITIAL_ADMIN_EMAIL` before signing up, registered with the wrong email, or need to restore admin access after losing it, run:

```bash
npm run admin:promote -- --email=admin@yourjournal.org
```

The user must already exist (registered via the **Sign up** tab on `/login`). The script reads `DATABASE_URL` from `.env.local` automatically.

For deployed installations, invoke this inside the running container:

| Tier | Command |
|---|---|
| Self-hosted Docker | `docker exec -it ems-app npm run admin:promote -- --email=admin@yourjournal.org` |
| Railway | `railway run npm run admin:promote -- --email=admin@yourjournal.org` |
| Azure Container Apps | `az containerapp exec --name ems-app --resource-group <rg> --command "npm run admin:promote -- --email=admin@yourjournal.org"` |

### Option C — Direct SQL (last resort)

If neither of the above is available, run this against the database directly:

```sql
UPDATE "user" SET system_admin = true WHERE email = 'admin@yourjournal.org';
```

The user must already exist. This is the same operation as Option B, just without the wrapper script.

---

## 2. Creating your first journal

Navigate to **Admin → Journals → Add Journal**.

Required fields:
- **Name** — the full journal name, e.g. *Journal of Applied Ecology*
- **Acronym** — short uppercase identifier, e.g. `JAE`. This becomes the URL slug for all journal routes (`/journal/JAE/...`) and must be globally unique. Choose carefully — changing it later requires updating bookmarks and any custom domain configuration.

Optional fields:
- **ISSN** — used for display and metadata
- **Subject Area** — used by the reviewer selection agent to match reviewers to manuscripts

**Verify:** The journal card appears on the platform landing page at `/`.

---

## 3. Setting up users and roles

<!--
TODO: Document the full user creation flow once Better Auth is integrated.
Current state: users are seeded directly in the database.
Cover:
- Creating a user account (admin creates the account, user receives invitation email)
- Assigning journal roles (author, reviewer, assistant_editor, editor, editor_in_chief, editorial_support)
- The distinction between system_admin (installation-wide) and journal roles (scoped to one journal)
- A user can hold different roles on different journals
-->

---

## 4. Defining manuscript types

Navigate to **Admin → Manuscript Types → Add Manuscript Type**.

Manuscript types define the submission categories your journals accept — Original Research, Review Article, Case Report, Letter, etc. Each type can be linked to its own workflow definition, allowing different review processes for different kinds of submissions.

Fields:
- **Name** — display name, e.g. *Review Article*
- **Acronym** — short code used internally and in the URL, e.g. `REV`
- **Description** — shown to authors at submission time
- **Workflow** — the workflow definition this type follows (link after creating the workflow)
- **Active** — inactive types are hidden from the submission form but preserved in historical records

---

## 5. Creating email templates

Navigate to **Admin → Email Templates → Add Template**.

Email templates are `EmailTemplate` nodes in the workflow graph. They are attached to communication action nodes in a workflow — when the workflow engine reaches a "send email" step, it resolves the template linked to that node and sends it to the appropriate recipient.

Fields:
- **Name** — internal reference name, e.g. *Reviewer Invitation*
- **Subject** — email subject line; supports template variables (see below)
- **Body** — email body; supports template variables and Markdown

**Template variables:**

<!--
TODO: Document the full set of template variables once the email system is built.
Expected variables: {{manuscript.title}}, {{author.name}}, {{reviewer.name}}, {{journal.name}}, {{deadline}}, {{decision}}, etc.
-->

---

## 6. Configuring workflows with Claude

Navigate to **Admin → Workflow Config**.

This is the primary interface for creating and modifying workflow definitions. You describe what you want in plain language; Claude translates it into graph mutations.

### How it works

1. **Describe your workflow.** Write what you want in plain language, as you would explain it to a new colleague:

   > *"For a Research Article, we need three reviewers. Reviewers have 21 days. If all three submit, the editor is notified. If any are late, send a reminder and extend by 7 days. If still missing after the extension, escalate to the Editor-in-Chief."*

2. **Claude stages the mutations.** Claude reads the description, breaks it into graph nodes and relationships, and presents a plain-language summary of what it will create — including a numbered linear visual of the workflow with gate branching shown inline. No changes have been made yet.

3. **Review and confirm.** Read Claude's summary. If something is wrong, correct it in the next message. When you're satisfied, reply with a confirmation (e.g. *"Looks right, go ahead"*).

4. **Claude commits.** The graph mutations are applied. Claude presents the final workflow visual as confirmation.

### Tips for describing workflows

- Be explicit about numbers: *"three reviewers"*, *"21 days"*, not *"a few reviewers"* or *"a reasonable deadline"*
- Describe what happens on failure, not just success: *"if a reviewer doesn't respond within 7 days, send a reminder"*
- Mention escalation conditions: *"if two reminders go unanswered, invite a replacement reviewer"*
- Describe email communications: *"send the author a decision letter using the Major Revision template"*

### Modifying an existing workflow

Ask Claude to describe the current workflow first:

> *"Show me the current workflow for Research Articles."*

Claude fetches the graph and renders it as a numbered list. Then describe your change:

> *"Change the reviewer deadline from 21 days to 28 days and add a second reminder before escalation."*

The same stage-review-confirm cycle applies.

### What Claude will not do

Claude will not commit mutations without explicit confirmation. If you close the browser mid-conversation, no partial changes are saved. Each session starts fresh — previous conversations are not retained.

---

## 7. Reading the graph view

Navigate to **Admin → Graph View**.

The graph view is a read-only visualisation of the entire workflow graph across all journals. It is intended for verifying that Claude's mutations produced the expected structure, spotting orphaned nodes, and understanding how workflows connect.

**Only Claude writes to the graph.** There are no editing controls in this view by design.

### Layout

Nodes are positioned by the ForceAtlas2 layout algorithm, which groups related nodes together and separates unrelated clusters. The layout runs for a few seconds after the page loads and then settles.

### Node colours

| Colour | Node type |
|---|---|
| Indigo | Person |
| Amber | Manuscript |
| Red | Gate |
| Green | WorkflowDefinition |
| Blue | Task |
| Purple | Review |
| Pink | EmailTemplate |
| Teal | Journal |

### Inspecting a node

Click any node to open the inspector panel on the right. The panel shows the node's type, display label, and all stored properties. Click the background or the ✕ to dismiss.

### What to check after configuring a workflow

- All expected nodes are present and correctly labelled
- Gate nodes have the right `type`, `minimum`, and `deadline_days` properties
- EmailTemplate nodes are linked to the correct communication steps
- No orphaned nodes (nodes with no edges) unless they are intentionally standalone

---

## 8. Troubleshooting with Claude

Navigate to **Admin → Troubleshooting**.

When something goes wrong — a manuscript is stuck, a workflow step was skipped, an email didn't send — describe the problem to Claude:

> *"Manuscript #47 in the NEJM journal has been sitting at the review stage for six weeks with no activity."*

Claude queries the manuscript's gate state, task assignments, reviewer invitations, and event history, then explains what it found and proposes a corrective action. The same confirm-before-commit rule applies — no changes are made until you confirm.

### Effective problem descriptions

Include as much context as you have:
- Manuscript ID or title
- Journal acronym
- What you expected to happen and what actually happened
- Approximate date the problem started

### What Claude can diagnose

- Stuck manuscripts (gate not evaluating, missing trigger event)
- Missing reviewer invitations (invitation node created but email not sent)
- Stalled decision tasks (editor task created but not surfaced in the dashboard)
- Workflow misconfiguration (gate wired to wrong outcome node)
- Event log gaps (expected events not recorded)

### What Claude cannot fix

Claude cannot recover data that was never written. If an email was never sent because the SMTP configuration was wrong, Claude can re-trigger the send — but it cannot reconstruct what the email would have said if the template was not stored.

---

## 9. Handing off to journal admins

Once a journal is set up — workflow defined, manuscript types configured, email templates in place — assign a journal admin role to the editorial office's designated person.

<!--
TODO: Document the role assignment flow once Better Auth is integrated.
-->

Journal admins can then:
- Modify their journal's workflow via the journal-scoped Workflow Config chat
- Manage their own users, manuscript types, and email templates
- Troubleshoot issues scoped to their journal

They cannot access other journals' data, system-level settings, or the Graph View.

See [journal-admin.md](journal-admin.md) for the journal admin guide.
