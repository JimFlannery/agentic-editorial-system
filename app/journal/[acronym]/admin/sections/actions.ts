"use server"

import { sql } from "@/lib/graph"
import { revalidatePath } from "next/cache"

async function getAcronym(journalId: string): Promise<string> {
  const rows = await sql<{ acronym: string }>(
    "SELECT acronym FROM manuscript.journals WHERE id = $1",
    [journalId]
  )
  return rows[0]?.acronym ?? ""
}

export async function upsertSection(journalId: string, formData: FormData) {
  const id = formData.get("id") as string | null
  const name = (formData.get("name") as string)?.trim()
  const tagsRaw = (formData.get("subject_tags") as string)?.trim()
  const display_order = parseInt(formData.get("display_order") as string) || 0

  if (!name) throw new Error("Section name is required")

  // Parse comma-separated tags, normalise to lowercase
  const subject_tags = tagsRaw
    ? tagsRaw.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean)
    : []

  if (id) {
    await sql(
      `UPDATE manuscript.journal_sections
       SET name = $1, subject_tags = $2, display_order = $3
       WHERE id = $4 AND journal_id = $5`,
      [name, subject_tags, display_order, id, journalId]
    )
  } else {
    await sql(
      `INSERT INTO manuscript.journal_sections (journal_id, name, subject_tags, display_order)
       VALUES ($1, $2, $3, $4)`,
      [journalId, name, subject_tags, display_order]
    )
  }

  const acronym = await getAcronym(journalId)
  revalidatePath(`/journal/${acronym}/admin/sections`)
}

export async function toggleSection(journalId: string, sectionId: string, active: boolean) {
  await sql(
    `UPDATE manuscript.journal_sections SET active = $1 WHERE id = $2 AND journal_id = $3`,
    [active, sectionId, journalId]
  )

  const acronym = await getAcronym(journalId)
  revalidatePath(`/journal/${acronym}/admin/sections`)
}

export async function deleteSection(journalId: string, sectionId: string) {
  // ON DELETE SET NULL on person_roles.section_id means this is safe to delete
  await sql(
    `DELETE FROM manuscript.journal_sections WHERE id = $1 AND journal_id = $2`,
    [sectionId, journalId]
  )

  const acronym = await getAcronym(journalId)
  revalidatePath(`/journal/${acronym}/admin/sections`)
}
