"use server"

import { sql } from "@/lib/graph"
import { revalidatePath } from "next/cache"

export async function addUser(formData: FormData) {
  const journal_id = formData.get("journal_id") as string
  const full_name = (formData.get("full_name") as string)?.trim()
  const email = (formData.get("email") as string)?.trim()
  const orcid = (formData.get("orcid") as string)?.trim() || null
  const roles = formData.getAll("roles") as string[]

  if (!journal_id) throw new Error("Journal is required")
  if (!full_name) throw new Error("Full name is required")
  if (!email) throw new Error("Email is required")

  const [person] = await sql<{ id: string }>(
    `INSERT INTO manuscript.people (journal_id, email, full_name, orcid)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [journal_id, email, full_name, orcid]
  )

  if (roles.length > 0) {
    for (const role of roles) {
      await sql(
        `INSERT INTO manuscript.person_roles (person_id, journal_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [person.id, journal_id, role]
      )
    }
  }

  revalidatePath("/admin/users")
}
