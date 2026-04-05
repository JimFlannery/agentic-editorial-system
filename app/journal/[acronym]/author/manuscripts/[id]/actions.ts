"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/graph"
import { uploadFile, manuscriptKey } from "@/lib/storage"
import { revalidatePath } from "next/cache"
import { sendEmail, revisionReceivedEmail } from "@/lib/email"

export async function submitRevision(
  acronym: string,
  manuscriptId: string,
  journalId: string,
  formData: FormData
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error("Not authenticated")

  // Verify the person is the author of this manuscript
  const personRows = await sql<{ id: string }>(
    `SELECT p.id FROM manuscript.people p
     JOIN manuscript.manuscripts m ON m.submitted_by = p.id
     WHERE p.auth_user_id = $1
       AND p.journal_id = $2
       AND m.id = $3
       AND m.status = 'revision_requested'`,
    [session.user.id, journalId, manuscriptId]
  )
  const person = personRows[0]
  if (!person) throw new Error("Not authorised to revise this manuscript")

  const responseLetter = (formData.get("response_letter") as string)?.trim()
  const manuscriptFile = formData.get("manuscript_file") as File | null

  if (!responseLetter) throw new Error("Response letter is required")
  if (!manuscriptFile || manuscriptFile.size === 0) throw new Error("Revised manuscript file is required")

  // Upload the new file, overwriting the existing key
  const key = manuscriptKey(journalId, manuscriptId, manuscriptFile.name)
  await uploadFile(key, manuscriptFile)

  // Update the manuscript record — reset status and update file reference
  await sql(
    `UPDATE manuscript.manuscripts
     SET status = 'submitted',
         file_key = $1,
         file_name = $2,
         file_size = $3
     WHERE id = $4`,
    [key, manuscriptFile.name, manuscriptFile.size, manuscriptId]
  )

  // Record the revision event
  await sql(
    `INSERT INTO history.events
       (journal_id, manuscript_id, event_type, actor_id, actor_type, payload)
     VALUES ($1, $2, 'revision.submitted', $3, 'person', $4)`,
    [
      journalId,
      manuscriptId,
      person.id,
      JSON.stringify({ response_letter: responseLetter, file_key: key }),
    ]
  )

  // Notify the editor who sent the most recent decision
  const editorRows = await sql<{
    editor_name: string
    editor_email: string
    manuscript_title: string
    journal_name: string
  }>(`
    SELECT
      p.full_name AS editor_name,
      p.email     AS editor_email,
      m.title     AS manuscript_title,
      j.name      AS journal_name
    FROM history.events e
    JOIN manuscript.people   p ON p.id = e.actor_id
    JOIN manuscript.manuscripts m ON m.id = e.manuscript_id
    JOIN manuscript.journals    j ON j.id = m.journal_id
    WHERE e.manuscript_id = $1
      AND e.event_type = 'decision.sent'
    ORDER BY e.occurred_at DESC
    LIMIT 1
  `, [manuscriptId])

  const editorData = editorRows[0]
  if (editorData) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? ""
    const { subject, html } = revisionReceivedEmail({
      editor_name:      editorData.editor_name,
      manuscript_title: editorData.manuscript_title,
      journal_name:     editorData.journal_name,
      manuscript_url:   `${baseUrl}/journal/${acronym}/editorial/manuscripts/${manuscriptId}`,
    })
    await sendEmail({ to: editorData.editor_email, subject, html })
  }

  revalidatePath(`/journal/${acronym}/author/manuscripts/${manuscriptId}`)
  redirect(`/journal/${acronym}/author`)
}
