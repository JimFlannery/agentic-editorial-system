"use server"

import { sql } from "@/lib/graph"
import { revalidatePath } from "next/cache"

const ALLOWED_FIELD_TYPES = ["boolean", "text", "textarea", "select", "date", "file"]

export async function upsertField(journalId: string, formData: FormData) {
  const id         = formData.get("id") as string | null
  const field_key  = (formData.get("field_key") as string)?.trim().replace(/\s+/g, "_").toLowerCase()
  const label      = (formData.get("label") as string)?.trim()
  const description= (formData.get("description") as string)?.trim() || null
  const field_type = formData.get("field_type") as string
  const required   = formData.get("required") === "true"
  const optionsRaw = (formData.get("options") as string)?.trim() || null

  if (!field_key) throw new Error("Field key is required")
  if (!label)     throw new Error("Label is required")
  if (!ALLOWED_FIELD_TYPES.includes(field_type)) throw new Error("Invalid field type")

  let options: string[] | null = null
  if (field_type === "select" && optionsRaw) {
    options = optionsRaw.split("\n").map((s) => s.trim()).filter(Boolean)
  }

  const acronymRows = await sql<{ acronym: string }>(
    "SELECT acronym FROM manuscript.journals WHERE id = $1",
    [journalId]
  )
  const acronym = acronymRows[0]?.acronym

  if (id) {
    await sql(
      `UPDATE manuscript.form_fields
       SET label = $1, description = $2, field_type = $3, required = $4, options = $5
       WHERE id = $6 AND journal_id = $7`,
      [label, description, field_type, required, options ? JSON.stringify(options) : null, id, journalId]
    )
  } else {
    const maxOrder = await sql<{ max: number | null }>(
      "SELECT MAX(display_order) AS max FROM manuscript.form_fields WHERE journal_id = $1 AND form_type = 'submission'",
      [journalId]
    )
    const nextOrder = (maxOrder[0]?.max ?? 0) + 10

    await sql(
      `INSERT INTO manuscript.form_fields
         (journal_id, form_type, field_key, label, description, field_type, required, display_order, options)
       VALUES ($1, 'submission', $2, $3, $4, $5, $6, $7, $8)`,
      [journalId, field_key, label, description, field_type, required, nextOrder,
       options ? JSON.stringify(options) : null]
    )
  }

  revalidatePath(`/journal/${acronym}/admin/form-fields`)
}

export async function toggleField(id: string, journalId: string, active: boolean) {
  await sql(
    "UPDATE manuscript.form_fields SET active = $1 WHERE id = $2 AND journal_id = $3",
    [active, id, journalId]
  )
  const acronymRows = await sql<{ acronym: string }>(
    "SELECT acronym FROM manuscript.journals WHERE id = $1",
    [journalId]
  )
  revalidatePath(`/journal/${acronymRows[0]?.acronym}/admin/form-fields`)
}

export async function reorderFields(journalId: string, orderedIds: string[]) {
  for (let i = 0; i < orderedIds.length; i++) {
    await sql(
      "UPDATE manuscript.form_fields SET display_order = $1 WHERE id = $2 AND journal_id = $3",
      [(i + 1) * 10, orderedIds[i], journalId]
    )
  }
  const acronymRows = await sql<{ acronym: string }>(
    "SELECT acronym FROM manuscript.journals WHERE id = $1",
    [journalId]
  )
  revalidatePath(`/journal/${acronymRows[0]?.acronym}/admin/form-fields`)
}
