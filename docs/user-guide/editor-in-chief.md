# Editor-in-Chief Guide

As Editor-in-Chief, you have oversight of the entire editorial process for your journal. Your queue contains escalations from editors, manuscripts that have triggered automated escalation (missed deadlines, repeated reviewer failures), and any case that requires final authority.

---

## Contents

1. [Your dashboard](#1-your-dashboard)
2. [Types of escalation](#2-types-of-escalation)
3. [Handling editor escalations](#3-handling-editor-escalations)
4. [Handling automated escalations](#4-handling-automated-escalations)
5. [Overriding an editor's decision](#5-overriding-an-editors-decision)
6. [Appeals](#6-appeals)
7. [Research misconduct](#7-research-misconduct)
8. [Editorial board management](#8-editorial-board-management)
9. [Journal-level oversight](#9-journal-level-oversight)

---

## 1. Your dashboard

Navigate to `/journal/[acronym]/editorial/editor-in-chief`.

Your dashboard shows four stat cards at the top:

| Card | What it shows |
|---|---|
| **Checklist Queue** | Manuscripts awaiting admin checklist review |
| **Under Review** | Manuscripts currently with reviewers |
| **Awaiting Revision** | Manuscripts where a revision has been requested |
| **Stalled** | Manuscripts with no activity in the last 20+ days |

Below the stat cards:

- **Monthly metrics** — submissions this month and average days to decision, so you can track throughput at a glance
- **Stalled manuscripts** — a list of specific manuscripts with no recent activity; click any to open the detail page and investigate
- **Recent decisions** — the most recent accept/reject/revision decisions across all editors, with links to each manuscript

---

## 2. Types of escalation

Escalations reach your queue two ways:

**Editor-initiated** — an Editor explicitly escalated the manuscript. The editor's note explains why. These require your judgment before the workflow can proceed.

**Automated** — the workflow's escalation gate fired because a deadline was missed or a condition was not met after the allowed extension period. Common triggers:
- Reviewers are still missing after the extended deadline
- A replacement reviewer could not be found within the allowed time
- A revised manuscript was not submitted within the deadline

---

## 3. Handling editor escalations

Open the escalation from your dashboard. You will see:
- The manuscript detail and review history
- The editor's escalation note
- The reviewer reports (if the manuscript is past the review stage)

Your options:
- **Make a decision** — send a decision directly (bypassing the editor if necessary)
- **Return to editor** — add guidance and send it back for the editor to act on
- **Request additional review** — invite a new reviewer if the existing evidence is insufficient
- **Reject with Transfer** — if the manuscript is not suitable

---

## 4. Handling automated escalations

Automated escalations typically involve the reviewer process breaking down. When you open an automated escalation, Claude has already queried the manuscript state — the event log shows what happened and when.

Common scenarios:

**All reviewers are late after the extension period**
Options: extend the deadline again (use the Troubleshooting chat to update the gate), invite replacement reviewers, or make a decision based on the reviews received so far.

**Replacement reviewer invitation failed**
The system could not find a suitable reviewer after N declines. You may need to invite a reviewer manually, reach out to your editorial board, or make a decision with fewer than the standard number of reviews.

---

## 5. Overriding an editor's decision

In rare cases you may need to reverse or modify an editor's decision — for example, if a formal complaint reveals a procedural error.

<!--
TODO: Document the decision override flow once built.
This is a sensitive action — it should require a note explaining the reason, and both the original decision and the override should be recorded in the history log with timestamps and actor IDs.
-->

---

## 6. Appeals

When an author formally appeals a rejection:

1. The appeal arrives via the editorial office (typically Editorial Support)
2. It is added to your queue as an escalation with the appeal letter attached
3. Review the original decision, the reviewer reports, and the author's argument
4. If the appeal has merit, you may invite new reviewers or reverse the decision
5. If the appeal does not have merit, send a final rejection with a clear explanation

All appeal communications and decisions are recorded in the manuscript history log.

<!--
TODO: Document the formal appeal intake flow once built.
-->

---

## 7. Research misconduct

If a research integrity flag is raised — either by the AI screening at submission or discovered later by a reviewer or editor:

<!--
TODO: Document the research misconduct handling workflow once the integrity screening agent is built.
Cover:
- The integrity report and how to interpret it
- Escalation to COPE (Committee on Publication Ethics) guidelines
- Communication with the author's institution
- Retraction process (if applicable post-publication)
- Record-keeping requirements
-->

---

## 8. Editorial board management

<!--
TODO: Document editorial board management once built.
Cover:
- Adding and removing board members
- Area editor assignments by subject area
- Board member review workload tracking
-->

---

## 9. Journal-level oversight

The EIC dashboard provides aggregate metrics for the journal. Use these to identify systemic problems:

- **High time-to-first-decision** — may indicate editors are not processing their queues, or reviewers are consistently late
- **High decline rate for review invitations** — may indicate the reviewer pool needs expanding, or the invitation email needs improving
- **Increasing desk rejection rate** — may indicate scope guidance for authors needs clarifying

For deeper investigation, use the Troubleshooting chat in the journal admin panel — describe what you are seeing and Claude will query the event log for patterns.
