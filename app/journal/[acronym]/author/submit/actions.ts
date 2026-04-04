"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/graph"
import { uploadFile, manuscriptKey } from "@/lib/storage"

export async function submitManuscript(acronym: string, formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error("Not authenticated")

  const journalRows = await sql<{ id: string }>(
    "SELECT id FROM manuscript.journals WHERE UPPER(acronym) = UPPER($1)",
    [acronym]
  )
  const journal = journalRows[0]
  if (!journal) throw new Error("Journal not found")

  const personRows = await sql<{ id: string }>(
    "SELECT id FROM manuscript.people WHERE auth_user_id = $1 AND journal_id = $2",
    [session.user.id, journal.id]
  )
  const person = personRows[0]
  if (!person) throw new Error("Author not provisioned for this journal")

  const title           = (formData.get("title") as string)?.trim()
  const abstract        = (formData.get("abstract") as string)?.trim()
  const manuscript_type = (formData.get("manuscript_type") as string)?.trim()
  const manuscriptFile  = formData.get("manuscript_file") as File | null

  if (!title)           throw new Error("Title is required")
  if (!abstract)        throw new Error("Abstract is required")
  if (!manuscript_type) throw new Error("Manuscript type is required")
  if (!manuscriptFile || manuscriptFile.size === 0) throw new Error("Manuscript file is required")

  // Gather dynamic field values into payload JSONB
  const payload: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) {
    if (["title", "abstract", "manuscript_type", "manuscript_file"].includes(key)) continue
    payload[key] = value === "on" ? true : value
  }

  // Create manuscript record first to get the ID for the storage key
  const manuscriptRows = await sql<{ id: string }>(
    `INSERT INTO manuscript.manuscripts
       (journal_id, title, abstract, manuscript_type, submitted_by, status)
     VALUES ($1, $2, $3, $4, $5, 'submitted')
     RETURNING id`,
    [journal.id, title, abstract, manuscript_type, person.id]
  )
  const manuscript = manuscriptRows[0]

  // Upload manuscript file to S3/MinIO
  const key = manuscriptKey(journal.id, manuscript.id, manuscriptFile.name)
  await uploadFile(key, manuscriptFile)

  // Store file reference on the manuscript record
  await sql(
    `UPDATE manuscript.manuscripts
     SET file_key = $1, file_name = $2, file_size = $3
     WHERE id = $4`,
    [key, manuscriptFile.name, manuscriptFile.size, manuscript.id]
  )

  // Record submission event
  await sql(
    `INSERT INTO history.events (journal_id, manuscript_id, event_type, actor_id, actor_type, payload)
     VALUES ($1, $2, 'manuscript.submitted', $3, 'person', $4)`,
    [journal.id, manuscript.id, person.id, JSON.stringify({ ...payload, file_key: key })]
  )

  redirect(`/journal/${acronym}/author`)
}
