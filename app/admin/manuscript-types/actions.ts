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

  revalidatePath("/admin/manuscript-types")
}
