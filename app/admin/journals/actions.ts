"use server"

import { sql } from "@/lib/graph"
import { revalidatePath } from "next/cache"

export async function addJournal(formData: FormData) {
  const name = (formData.get("name") as string)?.trim()
  const acronym = (formData.get("acronym") as string)?.trim().toUpperCase()
  const issn = (formData.get("issn") as string)?.trim() || null
  const subject_area = (formData.get("subject_area") as string)?.trim() || null

  if (!name) throw new Error("Journal name is required")
  if (!acronym) throw new Error("Acronym is required")

  try {
    await sql(
      `INSERT INTO manuscript.journals (name, acronym, issn, subject_area)
       VALUES ($1, $2, $3, $4)`,
      [name, acronym, issn, subject_area]
    )
  } catch (e: any) {
    if (e?.code === "23505") throw new Error(`Acronym "${acronym}" is already in use`)
    throw e
  }

  revalidatePath("/admin/journals")
}

export async function editJournal(id: string, formData: FormData) {
  const name = (formData.get("name") as string)?.trim()
  const acronym = (formData.get("acronym") as string)?.trim().toUpperCase()
  const issn = (formData.get("issn") as string)?.trim() || null
  const subject_area = (formData.get("subject_area") as string)?.trim() || null

  if (!name) throw new Error("Journal name is required")
  if (!acronym) throw new Error("Acronym is required")

  try {
    await sql(
      `UPDATE manuscript.journals SET name = $1, acronym = $2, issn = $3, subject_area = $4 WHERE id = $5`,
      [name, acronym, issn, subject_area, id]
    )
  } catch (e: any) {
    if (e?.code === "23505") throw new Error(`Acronym "${acronym}" is already in use`)
    throw e
  }

  revalidatePath("/admin/journals")
}
