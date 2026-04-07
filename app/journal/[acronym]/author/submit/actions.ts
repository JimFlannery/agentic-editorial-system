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

  // Parse co-authors
  const coauthorCount = parseInt(formData.get("coauthor_count") as string) || 0
  const coauthors: Array<{ name: string; email: string; orcid: string | null }> = []
  for (let i = 0; i < coauthorCount; i++) {
    const name  = (formData.get(`coauthor_name_${i}`) as string)?.trim()
    const email = (formData.get(`coauthor_email_${i}`) as string)?.trim()
    const orcid = (formData.get(`coauthor_orcid_${i}`) as string)?.trim() || null
    if (name && email) coauthors.push({ name, email, orcid })
  }

  // Gather dynamic field values into payload JSONB
  const payload: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) {
    if (["title", "abstract", "manuscript_type", "manuscript_file", "coauthor_count"].includes(key)) continue
    if (key.startsWith("coauthor_")) continue
    payload[key] = value === "on" ? true : value
  }

  // Allocate a tracking number (e.g. TEST-2026-0003) before insert
  const trackingRows = await sql<{ tracking_number: string }>(
    `SELECT manuscript.next_tracking_number($1) AS tracking_number`,
    [journal.id]
  )
  const trackingNumber = trackingRows[0].tracking_number

  // Create manuscript record
  const manuscriptRows = await sql<{ id: string }>(
    `INSERT INTO manuscript.manuscripts
       (journal_id, title, abstract, manuscript_type, submitted_by, status, tracking_number)
     VALUES ($1, $2, $3, $4, $5, 'submitted', $6)
     RETURNING id`,
    [journal.id, title, abstract, manuscript_type, person.id, trackingNumber]
  )
  const manuscript = manuscriptRows[0]

  // Upload manuscript file
  const key = manuscriptKey(journal.id, manuscript.id, manuscriptFile.name)
  await uploadFile(key, manuscriptFile)

  await sql(
    `UPDATE manuscript.manuscripts
     SET file_key = $1, file_name = $2, file_size = $3
     WHERE id = $4`,
    [key, manuscriptFile.name, manuscriptFile.size, manuscript.id]
  )

  // Insert corresponding author into manuscript_authors
  await sql(
    `INSERT INTO manuscript.manuscript_authors
       (manuscript_id, person_id, is_corresponding, display_order)
     VALUES ($1, $2, true, 0)
     ON CONFLICT (manuscript_id, person_id) DO NOTHING`,
    [manuscript.id, person.id]
  )

  // Upsert co-authors and add to manuscript_authors
  for (let i = 0; i < coauthors.length; i++) {
    const { name, email, orcid } = coauthors[i]

    // Upsert person by email + journal — create if not already in the system
    const coauthorRows = await sql<{ id: string }>(
      `INSERT INTO manuscript.people (journal_id, full_name, email, orcid)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (journal_id, email)
       DO UPDATE SET full_name = EXCLUDED.full_name,
                     orcid = COALESCE(EXCLUDED.orcid, manuscript.people.orcid)
       RETURNING id`,
      [journal.id, name, email, orcid]
    )
    const coauthor = coauthorRows[0]

    await sql(
      `INSERT INTO manuscript.manuscript_authors
         (manuscript_id, person_id, is_corresponding, display_order)
       VALUES ($1, $2, false, $3)
       ON CONFLICT (manuscript_id, person_id) DO NOTHING`,
      [manuscript.id, coauthor.id, i + 1]
    )
  }

  // Record submission event
  await sql(
    `INSERT INTO history.events (journal_id, manuscript_id, event_type, actor_id, actor_type, payload)
     VALUES ($1, $2, 'manuscript.submitted', $3, 'person', $4)`,
    [journal.id, manuscript.id, person.id, JSON.stringify({ ...payload, file_key: key, coauthor_count: coauthors.length })]
  )

  redirect(`/journal/${acronym}/author`)
}
