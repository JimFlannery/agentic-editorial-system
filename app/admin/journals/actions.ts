"use server"

import { sql } from "@/lib/graph"
import { revalidatePath } from "next/cache"

export async function addJournal(formData: FormData) {
  const name = (formData.get("name") as string)?.trim()
  const issn = (formData.get("issn") as string)?.trim() || null
  const subject_area = (formData.get("subject_area") as string)?.trim() || null

  if (!name) throw new Error("Journal name is required")

  await sql(
    `INSERT INTO manuscript.journals (name, issn, subject_area)
     VALUES ($1, $2, $3)`,
    [name, issn, subject_area]
  )

  revalidatePath("/admin/journals")
}
