# Journal Admin Guide

The journal admin panel (`/journal/[acronym]/admin`) is where editorial offices configure and manage their journal on an ongoing basis. It is separate from the editorial workspace (`/journal/[acronym]/editorial`) where editors and reviewers do their day-to-day work.

Journal admins can only see and modify their own journal. If you need to configure a workflow from scratch or access the graph view, contact your system administrator.

---

## Contents

1. [Accessing the journal admin panel](#1-accessing-the-journal-admin-panel)
2. [Dashboard overview](#2-dashboard-overview)
3. [Managing manuscript types](#3-managing-manuscript-types)
4. [Managing email templates](#4-managing-email-templates)
5. [Managing users and roles](#5-managing-users-and-roles)
6. [Modifying workflows with Claude](#6-modifying-workflows-with-claude)
7. [Troubleshooting with Claude](#7-troubleshooting-with-claude)
8. [Journal settings](#8-journal-settings)

---

## 1. Accessing the journal admin panel

Navigate to `/journal/[acronym]/admin`, replacing `[acronym]` with your journal's acronym (e.g. `/journal/NEJM/admin`).

You must have an `assistant_editor`, `editor`, `editor_in_chief`, or `editorial_support` role on this journal to access the admin panel. The header shows a journal selector if you have access to multiple journals.

---

## 2. Dashboard overview

The dashboard shows a summary of your journal's configuration and links to each admin section. It also displays the current submission queue size and any configuration items that require attention (e.g. manuscript types with no workflow assigned).

---

## 3. Managing manuscript types

Navigate to **Journal Admin → Manuscript Types**.

Manuscript types define the submission categories your journal accepts. Common types include Original Research, Review Article, Systematic Review, Case Report, Letter, and Editorial. Each type can have its own workflow, checklist, and submission form configuration.

### Adding a manuscript type

Click **Add Manuscript Type** and fill in:
- **Name** — display name shown to authors (e.g. *Original Research*)
- **Acronym** — short code used in the system (e.g. `OR`)
- **Description** — shown to authors at submission, explaining what belongs in this category
- **Workflow** — select the workflow definition for this type; contact your system admin if the right workflow does not exist
- **Active** — uncheck to hide from the submission form without deleting

### Editing and deactivating

Click any manuscript type to edit it. Deactivating a type hides it from new submissions but preserves all historical manuscripts of that type.

---

## 4. Managing email templates

Navigate to **Journal Admin → Email Templates**.

Email templates are attached to workflow communication steps. When the workflow engine sends an email, it uses the template linked to that step and substitutes the template variables with real values.

### Adding a template

- **Name** — internal reference name used when linking templates to workflow steps (e.g. *Reviewer Invitation — Initial*)
- **Subject** — email subject; supports template variables
- **Body** — email body; supports template variables and Markdown

### Template variables

<!--
TODO: Document the full variable set once the email system is built.
Common variables: {{manuscript.title}}, {{author.name}}, {{reviewer.name}}, {{journal.name}}, {{deadline}}, {{decision}}, {{review_url}}
-->

### Linking templates to workflow steps

Templates are linked to communication nodes in the workflow graph via the Workflow Config chat. Describe the link to Claude:

> *"The reviewer invitation step should use the 'Reviewer Invitation — Initial' template."*

---

## 5. Managing users and roles

Navigate to **Journal Admin → Users**.

This section shows all people with roles on your journal and allows you to add new team members and edit existing role assignments.

### Adding a user

<!--
TODO: Document the full user invitation flow once Better Auth is integrated.
Cover:
- Entering the new user's email address
- Selecting their role(s) on this journal
- The invitation email they receive
- What happens if the email address already has an account
-->

### Roles

| Role | What they can do |
|---|---|
| **Author** | Submit manuscripts, track submission status, respond to revision requests |
| **Reviewer** | Accept or decline review invitations, submit reviews |
| **Assistant Editor** | Manage the checklist queue, invite reviewers, handle initial correspondence |
| **Editor** | Read reviewer reports, make accept/revise/reject decisions |
| **Editor-in-Chief** | All Editor permissions plus escalation handling and editorial oversight |
| **Editorial Support** | Author correspondence, administrative tasks, no editorial decision authority |

A person can hold multiple roles on the same journal (e.g. both Editor and Editorial Support) and different roles on different journals.

### Removing access

Deactivating a user removes their access without deleting their historical record. Their past actions remain in the event log.

---

## 6. Modifying workflows with Claude

Navigate to **Journal Admin → Workflow Config**.

This is the primary interface for adjusting your journal's workflows. You describe what you want in plain language; Claude translates it into graph mutations.

This chat is scoped to your journal — Claude can only read and modify workflows that belong to your journal.

### Viewing the current workflow

Start by asking Claude to show you the current workflow:

> *"Show me the current workflow for Original Research articles."*

Claude will render it as a numbered list with gate branching shown inline:

```
1. Manuscript submitted by Author
2. Assigned to Assistant Editor for checklist review
3. Invitations sent to 3 Reviewers
4. [GATE] 3 reviews submitted within 21 days?
   ├── PASS → Editor decision task created
   └── FAIL → Reminder sent to overdue reviewers; 7-day extension
              [GATE] Still missing after extension?
              ├── PASS → Editor decision task created
              └── ESCALATE → Editor-in-Chief notified
5. Editor sends decision
6. Decision email sent to Author
```

### Making changes

Describe the change you want:

> *"Change the reviewer deadline from 21 days to 28 days."*

> *"Add a second reminder 3 days after the first, before escalating to the EIC."*

> *"Add a new step after the decision: if the decision is Major Revision, create a 60-day task for the author to resubmit."*

Claude will stage the change and describe it in plain language before asking for confirmation. No changes are applied until you confirm.

### Things you can change

- Reviewer deadlines and reminder intervals
- Number of required reviewers
- Escalation conditions
- Email template assignments
- Decision outcomes and follow-up steps
- Adding or removing manuscript types from a workflow

### Things to ask your system admin about

- Creating a brand new workflow from scratch
- Changing the overall structure of a workflow (not just adjusting parameters)
- Adding new gate types not already in use

---

## 7. Troubleshooting with Claude

Navigate to **Journal Admin → Troubleshooting**.

Describe a problem and Claude will diagnose it, scoped to your journal:

> *"Manuscript 103 (submitted by Dr. Chen) hasn't moved in three weeks. The three reviewers were invited but I haven't heard back."*

Claude queries the manuscript's state, reviews the invitation and reminder history, and checks the event log. It will explain what happened and propose a fix, waiting for your confirmation before making any changes.

### Common problems journal admins encounter

**Reviewer hasn't responded to invitation**
Claude can check whether the invitation email was sent, whether a reminder has gone out, and how many days remain before the deadline triggers the escalation gate.

**Manuscript stuck at a decision step**
Claude can check whether the editor's task was created and is visible in their dashboard, or whether there is a gate waiting for an event that has not fired.

**Wrong email template used**
Claude can identify which template was sent and, if the correct one exists, re-send using the right template.

**Deadline was set incorrectly**
Claude can update the deadline on the active gate and re-evaluate it against the current state.

---

## 8. Journal settings

<!--
TODO: Document the journal settings page once the `manuscript.journal_settings` admin UI is built.
Key settings to cover:
- review_deadline_days (default reviewer deadline)
- min_reviewers / max_reviewers
- allow_author_reviewer_suggestions
- credit_taxonomy_enabled (CRediT contributor roles)
- integrity_screening_enabled and per-signal toggles
-->
