"use server"

import { sql } from "@/lib/graph"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

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
