"use server"

import { headers } from "next/headers"
import { sql } from "@/lib/graph"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

async function getReviewerPerson(journalId: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error("Not authenticated")
  const rows = await sql<{ id: string }>(
    "SELECT id FROM manuscript.people WHERE auth_user_id = $1 AND journal_id = $2",
    [session.user.id, journalId]
  )
  const person = rows[0]
  if (!person) throw new Error("Reviewer not provisioned for this journal")
  return person
}

export async function respondToInvitation(
  acronym: string,
  manuscriptId: string,
  journalId: string,
  response: "accepted" | "declined"
) {
  const person = await getReviewerPerson(journalId)

  await sql(`
    UPDATE manuscript.assignments
    SET invitation_status = $1
    WHERE manuscript_id = $2
      AND person_id = $3
      AND role = 'reviewer'
  `, [response, manuscriptId, person.id])

  await sql(`
    INSERT INTO history.events
      (journal_id, manuscript_id, event_type, actor_id, actor_type, payload)
    VALUES ($1, $2, $3, $4, 'person', $5)
  `, [
    journalId,
    manuscriptId,
    `reviewer.${response}`,
    person.id,
    JSON.stringify({ response }),
  ])

  revalidatePath(`/journal/${acronym}/reviewer/manuscripts/${manuscriptId}`)
  if (response === "declined") {
    redirect(`/journal/${acronym}/reviewer`)
  }
}

export async function submitReview(
  acronym: string,
  manuscriptId: string,
  journalId: string,
  formData: FormData
) {
  const person = await getReviewerPerson(journalId)

  const recommendation = (formData.get("recommendation") as string)?.trim()
  const summary        = (formData.get("summary") as string)?.trim()
  const comments_author   = (formData.get("comments_author") as string)?.trim()
  const comments_editor   = (formData.get("comments_editor") as string)?.trim()

  if (!recommendation) throw new Error("Recommendation is required")
  if (!summary)        throw new Error("Summary is required")

  // Record the review submission event
  await sql(`
    INSERT INTO history.events
      (journal_id, manuscript_id, event_type, actor_id, actor_type, payload)
    VALUES ($1, $2, 'review.submitted', $3, 'person', $4)
  `, [
    journalId,
    manuscriptId,
    person.id,
    JSON.stringify({ recommendation, summary, comments_author, comments_editor }),
  ])

  // Mark the assignment as completed
  await sql(`
    UPDATE manuscript.assignments
    SET invitation_status = 'completed'
    WHERE manuscript_id = $1
      AND person_id = $2
      AND role = 'reviewer'
  `, [manuscriptId, person.id])

  revalidatePath(`/journal/${acronym}/reviewer/manuscripts/${manuscriptId}`)
  redirect(`/journal/${acronym}/reviewer`)
}
