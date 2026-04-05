"use server"

import { headers } from "next/headers"
import { sql } from "@/lib/graph"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { sendEmail, reviewerInvitationEmail, decisionEmail } from "@/lib/email"

export async function passToEic(acronym: string, manuscriptId: string, journalId: string) {
  await sql(
    `UPDATE manuscript.manuscripts SET status = 'under_review' WHERE id = $1`,
    [manuscriptId]
  )

  await sql(
    `INSERT INTO history.events (journal_id, manuscript_id, event_type, actor_type, payload)
     VALUES ($1, $2, 'checklist.passed', 'person', $3)`,
    [journalId, manuscriptId, JSON.stringify({ action: "pass_to_eic" })]
  )

  revalidatePath(`/journal/${acronym}/editorial/manuscripts/${manuscriptId}`)
  redirect(`/journal/${acronym}/editorial/queue`)
}

export async function unsubmitManuscript(
  acronym: string,
  manuscriptId: string,
  journalId: string,
  reason: string
) {
  await sql(
    `UPDATE manuscript.manuscripts SET status = 'revision_requested' WHERE id = $1`,
    [manuscriptId]
  )

  await sql(
    `INSERT INTO history.events (journal_id, manuscript_id, event_type, actor_type, payload)
     VALUES ($1, $2, 'checklist.unsubmitted', 'person', $3)`,
    [journalId, manuscriptId, JSON.stringify({ action: "unsubmit", reason })]
  )

  revalidatePath(`/journal/${acronym}/editorial/manuscripts/${manuscriptId}`)
  redirect(`/journal/${acronym}/editorial/queue`)
}

export async function rejectWithTransfer(
  acronym: string,
  manuscriptId: string,
  journalId: string,
  transferTarget: string
) {
  await sql(
    `UPDATE manuscript.manuscripts SET status = 'rejected' WHERE id = $1`,
    [manuscriptId]
  )

  await sql(
    `INSERT INTO history.events (journal_id, manuscript_id, event_type, actor_type, payload)
     VALUES ($1, $2, 'checklist.rejected_transfer', 'person', $3)`,
    [journalId, manuscriptId, JSON.stringify({ action: "reject_with_transfer", transfer_target: transferTarget })]
  )

  revalidatePath(`/journal/${acronym}/editorial/manuscripts/${manuscriptId}`)
  redirect(`/journal/${acronym}/editorial/queue`)
}

// ---------------------------------------------------------------------------
// Reviewer invitation
// ---------------------------------------------------------------------------

export interface ReviewerSearchResult {
  id: string
  full_name: string
  email: string
  orcid: string | null
  already_invited: boolean
}

export async function searchReviewers(
  journalId: string,
  manuscriptId: string,
  query: string
): Promise<ReviewerSearchResult[]> {
  if (!query || query.trim().length < 2) return []

  const rows = await sql<ReviewerSearchResult>(`
    SELECT
      p.id,
      p.full_name,
      p.email,
      p.orcid,
      EXISTS (
        SELECT 1 FROM manuscript.assignments a
        WHERE a.manuscript_id = $2
          AND a.person_id = p.id
          AND a.role = 'reviewer'
          AND a.invitation_status != 'declined'
      ) AS already_invited
    FROM manuscript.people p
    WHERE p.journal_id = $1
      AND (
        p.full_name ILIKE $3
        OR p.email ILIKE $3
      )
      -- exclude the manuscript's author
      AND p.id NOT IN (
        SELECT submitted_by FROM manuscript.manuscripts WHERE id = $2
      )
    ORDER BY p.full_name
    LIMIT 10
  `, [journalId, manuscriptId, `%${query.trim()}%`])

  return rows
}

export async function inviteReviewer(
  acronym: string,
  manuscriptId: string,
  journalId: string,
  personId: string,
  dueDays: number
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error("Not authenticated")

  // Resolve the actor (the AE/editor doing the inviting)
  const actorRows = await sql<{ id: string }>(
    "SELECT id FROM manuscript.people WHERE auth_user_id = $1 AND journal_id = $2",
    [session.user.id, journalId]
  )
  const actor = actorRows[0]
  if (!actor) throw new Error("Actor not provisioned for this journal")

  const dueAt = new Date(Date.now() + dueDays * 86_400_000).toISOString()

  // Ensure the person has the reviewer role
  await sql(`
    INSERT INTO manuscript.person_roles (person_id, journal_id, role)
    VALUES ($1, $2, 'reviewer')
    ON CONFLICT DO NOTHING
  `, [personId, journalId])

  // Create the assignment (or re-invite if previously declined)
  await sql(`
    INSERT INTO manuscript.assignments
      (manuscript_id, person_id, role, invitation_status, due_at)
    VALUES ($1, $2, 'reviewer', 'invited', $3)
    ON CONFLICT (manuscript_id, person_id, role)
    DO UPDATE SET
      invitation_status = 'invited',
      due_at = EXCLUDED.due_at,
      released_at = NULL,
      assigned_at = now()
  `, [manuscriptId, personId, dueAt])

  // Record the event
  await sql(`
    INSERT INTO history.events
      (journal_id, manuscript_id, event_type, actor_id, actor_type, payload)
    VALUES ($1, $2, 'reviewer.invited', $3, 'person', $4)
  `, [journalId, manuscriptId, actor.id, JSON.stringify({ invited_person_id: personId, due_at: dueAt })])

  // Send invitation email
  const emailRows = await sql<{
    reviewer_name: string
    reviewer_email: string
    manuscript_title: string
    journal_name: string
  }>(`
    SELECT
      p.full_name   AS reviewer_name,
      p.email       AS reviewer_email,
      m.title       AS manuscript_title,
      j.name        AS journal_name
    FROM manuscript.people p
    JOIN manuscript.manuscripts m ON m.id = $2
    JOIN manuscript.journals    j ON j.id = $3
    WHERE p.id = $1
  `, [personId, manuscriptId, journalId])

  const emailData = emailRows[0]
  if (emailData) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? ""
    const { subject, html } = reviewerInvitationEmail({
      reviewer_name:    emailData.reviewer_name,
      manuscript_title: emailData.manuscript_title,
      journal_name:     emailData.journal_name,
      due_date:         new Date(dueAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      review_url:       `${baseUrl}/journal/${acronym}/reviewer/manuscripts/${manuscriptId}`,
    })
    await sendEmail({ to: emailData.reviewer_email, subject, html })
  }

  revalidatePath(`/journal/${acronym}/editorial/manuscripts/${manuscriptId}`)
}

export interface ReviewerAssignment {
  assignment_id: string
  person_id: string
  full_name: string
  email: string
  invitation_status: string
  assigned_at: string
  due_at: string | null
}

export async function getManuscriptReviewers(manuscriptId: string): Promise<ReviewerAssignment[]> {
  return sql<ReviewerAssignment>(`
    SELECT
      a.id   AS assignment_id,
      p.id   AS person_id,
      p.full_name,
      p.email,
      a.invitation_status,
      a.assigned_at::text,
      a.due_at::text
    FROM manuscript.assignments a
    JOIN manuscript.people p ON p.id = a.person_id
    WHERE a.manuscript_id = $1
      AND a.role = 'reviewer'
    ORDER BY a.assigned_at DESC
  `, [manuscriptId])
}

// ---------------------------------------------------------------------------
// Editor decision
// ---------------------------------------------------------------------------

export interface SubmittedReview {
  reviewer_name: string
  recommendation: string
  summary: string
  comments_author: string | null
  occurred_at: string
}

export async function getSubmittedReviews(manuscriptId: string): Promise<SubmittedReview[]> {
  return sql<SubmittedReview>(`
    SELECT
      p.full_name AS reviewer_name,
      e.payload->>'recommendation' AS recommendation,
      e.payload->>'summary'        AS summary,
      e.payload->>'comments_author' AS comments_author,
      e.occurred_at::text
    FROM history.events e
    JOIN manuscript.people p ON p.id = e.actor_id
    WHERE e.manuscript_id = $1
      AND e.event_type = 'review.submitted'
    ORDER BY e.occurred_at ASC
  `, [manuscriptId])
}

const DECISION_STATUS_MAP: Record<string, string> = {
  accept:          "accepted",
  minor_revision:  "revision_requested",
  major_revision:  "revision_requested",
  reject:          "rejected",
}

const DECISION_LABEL_MAP: Record<string, string> = {
  accept:         "Accept",
  minor_revision: "Minor Revision",
  major_revision: "Major Revision",
  reject:         "Reject",
}

export async function sendDecision(
  acronym: string,
  manuscriptId: string,
  journalId: string,
  decision: string,
  letter: string
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error("Not authenticated")

  const actorRows = await sql<{ id: string }>(
    "SELECT id FROM manuscript.people WHERE auth_user_id = $1 AND journal_id = $2",
    [session.user.id, journalId]
  )
  const actor = actorRows[0]
  if (!actor) throw new Error("Actor not provisioned for this journal")

  const newStatus = DECISION_STATUS_MAP[decision]
  if (!newStatus) throw new Error("Invalid decision")

  await sql(
    "UPDATE manuscript.manuscripts SET status = $1 WHERE id = $2",
    [newStatus, manuscriptId]
  )

  await sql(`
    INSERT INTO history.events
      (journal_id, manuscript_id, event_type, actor_id, actor_type, payload)
    VALUES ($1, $2, 'decision.sent', $3, 'person', $4)
  `, [
    journalId,
    manuscriptId,
    actor.id,
    JSON.stringify({ decision, letter }),
  ])

  // Send decision email to author
  const authorRows = await sql<{
    author_name: string
    author_email: string
    manuscript_title: string
    journal_name: string
  }>(`
    SELECT
      p.full_name AS author_name,
      p.email     AS author_email,
      m.title     AS manuscript_title,
      j.name      AS journal_name
    FROM manuscript.manuscripts m
    JOIN manuscript.people  p ON p.id = m.submitted_by
    JOIN manuscript.journals j ON j.id = m.journal_id
    WHERE m.id = $1
  `, [manuscriptId])

  const authorData = authorRows[0]
  if (authorData) {
    const { subject, html } = decisionEmail({
      author_name:      authorData.author_name,
      manuscript_title: authorData.manuscript_title,
      journal_name:     authorData.journal_name,
      decision_label:   DECISION_LABEL_MAP[decision] ?? decision,
      letter,
    })
    await sendEmail({ to: authorData.author_email, subject, html })
  }

  revalidatePath(`/journal/${acronym}/editorial/manuscripts/${manuscriptId}`)
  redirect(`/journal/${acronym}/editorial/editor`)
}
