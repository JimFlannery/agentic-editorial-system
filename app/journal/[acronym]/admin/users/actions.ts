"use server"

import { sql } from "@/lib/graph"
import { revalidatePath } from "next/cache"

// Roles journal-admins are permitted to assign. system_admin is excluded —
// that is only assignable via the /admin system-level users page.
const ASSIGNABLE_ROLES = new Set([
  "author", "reviewer", "assistant_editor", "editor",
  "editor_in_chief", "editorial_support", "journal_admin",
])

export async function addUser(formData: FormData) {
  const journal_id = formData.get("journal_id") as string
  const full_name = (formData.get("full_name") as string)?.trim()
  const email = (formData.get("email") as string)?.trim()
  const orcid = (formData.get("orcid") as string)?.trim() || null
  const roles = (formData.getAll("roles") as string[]).filter((r) => ASSIGNABLE_ROLES.has(r))

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

  const acronymRows = await sql<{ acronym: string }>(
    "SELECT acronym FROM manuscript.journals WHERE id = $1",
    [journal_id]
  )
  const acronym = acronymRows[0]?.acronym
  revalidatePath(`/journal/${acronym}/admin/users`)
}

export async function editUser(id: string, journalId: string, formData: FormData) {
  const full_name = (formData.get("full_name") as string)?.trim()
  const email = (formData.get("email") as string)?.trim()
  const orcid = (formData.get("orcid") as string)?.trim() || null
  const roles = (formData.getAll("roles") as string[]).filter((r) => ASSIGNABLE_ROLES.has(r))

  if (!full_name) throw new Error("Full name is required")
  if (!email) throw new Error("Email is required")

  await sql(
    `UPDATE manuscript.people SET full_name = $1, email = $2, orcid = $3 WHERE id = $4`,
    [full_name, email, orcid, id]
  )

  // Replace roles: delete existing, insert new
  await sql(
    `DELETE FROM manuscript.person_roles WHERE person_id = $1 AND journal_id = $2`,
    [id, journalId]
  )

  for (const role of roles) {
    await sql(
      `INSERT INTO manuscript.person_roles (person_id, journal_id, role) VALUES ($1, $2, $3)`,
      [id, journalId, role]
    )
  }

  const acronymRows = await sql<{ acronym: string }>(
    "SELECT acronym FROM manuscript.journals WHERE id = $1",
    [journalId]
  )
  const acronym = acronymRows[0]?.acronym
  revalidatePath(`/journal/${acronym}/admin/users`)
}
