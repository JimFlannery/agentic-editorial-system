"use server"

import { sql } from "@/lib/graph"
import { revalidatePath } from "next/cache"

export async function addManuscriptType(formData: FormData) {
  const journal_id = formData.get("journal_id") as string
  const name = (formData.get("name") as string)?.trim()
  const acronym = (formData.get("acronym") as string)?.trim().toUpperCase()
  const description = (formData.get("description") as string)?.trim() || null
  const display_order = parseInt(formData.get("display_order") as string) || 0

  if (!journal_id) throw new Error("Journal is required")
  if (!name) throw new Error("Name is required")
  if (!acronym) throw new Error("Acronym is required")

  await sql(
    `INSERT INTO manuscript.manuscript_types (journal_id, name, acronym, description, display_order)
     VALUES ($1, $2, $3, $4, $5)`,
    [journal_id, name, acronym, description, display_order]
  )

  const acronymRows = await sql<{ acronym: string }>(
    "SELECT acronym FROM manuscript.journals WHERE id = $1",
    [journal_id]
  )
  const journalAcronym = acronymRows[0]?.acronym
  revalidatePath(`/journal-admin/${journalAcronym}/manuscript-types`)
}

export async function editManuscriptType(id: string, formData: FormData) {
  const name = (formData.get("name") as string)?.trim()
  const acronym = (formData.get("acronym") as string)?.trim().toUpperCase()
  const description = (formData.get("description") as string)?.trim() || null
  const display_order = parseInt(formData.get("display_order") as string) || 0
  const active = formData.get("active") === "true"

  if (!name) throw new Error("Name is required")
  if (!acronym) throw new Error("Acronym is required")

  await sql(
    `UPDATE manuscript.manuscript_types
     SET name = $1, acronym = $2, description = $3, display_order = $4, active = $5
     WHERE id = $6`,
    [name, acronym, description, display_order, active, id]
  )

  const journalRows = await sql<{ acronym: string }>(
    `SELECT j.acronym FROM manuscript.journals j
     JOIN manuscript.manuscript_types mt ON mt.journal_id = j.id
     WHERE mt.id = $1`,
    [id]
  )
  const journalAcronym = journalRows[0]?.acronym
  revalidatePath(`/journal-admin/${journalAcronym}/manuscript-types`)
}
