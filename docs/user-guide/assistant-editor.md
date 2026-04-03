# Assistant Editor Guide

The Assistant Editor is the first person to handle a new submission. Your role is to verify that the manuscript meets the journal's requirements before it reaches an editor, and to manage the reviewer invitation process.

---

## Contents

1. [Your dashboard](#1-your-dashboard)
2. [The checklist queue](#2-the-checklist-queue)
3. [Reviewing the AI checklist](#3-reviewing-the-ai-checklist)
4. [Passing a manuscript to the Editor](#4-passing-a-manuscript-to-the-editor)
5. [Returning or rejecting at intake](#5-returning-or-rejecting-at-intake)
6. [Inviting reviewers](#6-inviting-reviewers)
7. [Managing the review period](#7-managing-the-review-period)
8. [When a reviewer is late](#8-when-a-reviewer-is-late)

---

## 1. Your dashboard

Navigate to `/journal/[acronym]/editorial/assistant-editor`.

Your dashboard shows:
- **Awaiting checklist review** — new submissions that have not yet been processed
- **In review** — manuscripts currently with reviewers
- **Awaiting decision** — all reviews received, waiting for the editor

---

## 2. The checklist queue

Navigate to **Checklist Queue** in the sidebar.

Every new submission appears here. The queue shows the manuscript title, type, submission date, and the status of the AI checklist evaluation.

When a manuscript is submitted, Claude automatically evaluates each checklist item. Most items are resolved before you open the manuscript — you only need to act on items marked **borderline** or **requires review**.

---

## 3. Reviewing the AI checklist

Click a manuscript to open its detail page.

The checklist shows each item with one of three statuses:

| Status | Meaning |
|---|---|
| **Pass** | Claude evaluated this item and it meets requirements. No action needed. |
| **Fail** | This item does not meet requirements. The manuscript should be returned to the author with an explanation. |
| **Borderline** | Claude evaluated the item but flagged it for human review. You must make a judgment call. |

**Borderline items** show Claude's reasoning inline. Read the reasoning, then either:
- **Accept** — confirm the item passes (your name and timestamp are recorded)
- **Override to fail** — mark the item as failing and add a note explaining why

Every accept and override is written to the manuscript's history log. You are accountable for borderline items — Claude's evaluation is advisory.

**Research integrity flags** (if enabled for your journal) appear separately below the standard checklist. These cover image integrity, author identity, and potential fraud signals. Treat flagged items the same way as borderline checklist items — read the reasoning, then accept or escalate.

---

## 4. Passing a manuscript to the Editor

Once all checklist items are resolved:

1. Confirm there are no outstanding issues
2. Click **Pass to Editor** (or **Pass to EIC** depending on your journal's workflow)
3. The manuscript status updates and an editor is notified

This action is recorded in the history log. The manuscript moves out of your queue.

---

## 5. Returning or rejecting at intake

If the manuscript clearly does not meet requirements and cannot be remedied by the author:

- **Unsubmit** — returns the manuscript to the author for correction and resubmission. Use this when the problem is fixable (missing figures, incomplete author list, formatting issues).
- **Reject** — closes the manuscript without the option to resubmit. Use this for desk rejections (out of scope, insufficient novelty) or integrity failures.
- **Reject with Transfer** — rejects the manuscript but offers transfer to a partner journal. The transfer offer is sent via the configured email template.

All three actions require a reason, which is included in the email to the author.

---

## 6. Inviting reviewers

Once a manuscript passes the checklist and is with an editor, reviewer invitations are typically managed by you on the editor's behalf.

<!--
TODO: Document the reviewer invitation flow once the reviewer selection agent is built.
Cover:
- Using the AI reviewer suggestion tool (subject area matching, COI detection, workload balancing)
- Manually adding reviewers not suggested by the AI
- Sending invitations (the invitation email uses the configured template)
- Tracking invitation status (pending, accepted, declined, expired)
- Inviting replacement reviewers after declines
-->

---

## 7. Managing the review period

<!--
TODO: Document review period management once built.
Cover:
- Monitoring reviewer progress from the manuscript detail page
- The automated reminder schedule (configured in the workflow)
- What the system does automatically vs. what requires manual action
-->

---

## 8. When a reviewer is late

The workflow handles routine lateness automatically — reminders go out on schedule, and escalation to the Editor-in-Chief fires if deadlines are missed after the extension period.

For unusual situations (a reviewer who has gone silent, a review with no response to multiple reminders, a suspected COI disclosed after acceptance), contact the journal admin or use the Troubleshooting chat:

Navigate to **Journal Admin → Troubleshooting** and describe the situation. Claude will check the review state and suggest a corrective action.
