"use server"

import { sql } from "@/lib/graph"
import { revalidatePath } from "next/cache"

const ASSIGNABLE_ROLES = new Set([
  "author", "reviewer", "assistant_editor", "editor",
  "editor_in_chief", "editorial_support", "journal_admin",
])

const SECTIONABLE_ROLES = new Set([
  "assistant_editor", "editor", "editorial_support", "editor_in_chief",
])

async function getAcronym(journalId: string): Promise<string> {
  const rows = await sql<{ acronym: string }>(
    "SELECT acronym FROM manuscript.journals WHERE id = $1",
    [journalId]
  )
  return rows[0]?.acronym ?? ""
}

/** Returns section_id string or null from the form value for a given role */
function sectionIdFor(role: string, formData: FormData): string | null {
  if (!SECTIONABLE_ROLES.has(role)) return null
  const val = (formData.get(`section_${role}`) as string)?.trim()
  return val || null
}

export async function addUser(formData: FormData) {
  const journal_id = formData.get("journal_id") as string
  const full_name = (formData.get("full_name") as string)?.trim()
  const email = (formData.get("email") as string)?.trim()
  const orcid = (formData.get("orcid") as string)?.trim() || null
  const roles = (formData.getAll("roles") as string[]).filter((r) => ASSIGNABLE_ROLES.has(r))

  if (!journal_id) throw new Error("Journal is required")
  if (!full_name) throw new Error("Full name is required")
  if (!email) throw new Error("Email is required")

  // Link to Better Auth user if one exists for this email
  const authRows = await sql<{ id: string }>(
    `SELECT id FROM public."user" WHERE email = $1`,
    [email]
  )
  const auth_user_id = authRows[0]?.id ?? null

  const [person] = await sql<{ id: string }>(
    `INSERT INTO manuscript.people (journal_id, email, full_name, orcid, auth_user_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [journal_id, email, full_name, orcid, auth_user_id]
  )

  for (const role of roles) {
    const section_id = sectionIdFor(role, formData)
    await sql(
      `INSERT INTO manuscript.person_roles (person_id, journal_id, role, section_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [person.id, journal_id, role, section_id]
    )
  }

  const acronym = await getAcronym(journal_id)
  revalidatePath(`/journal/${acronym}/admin/users`)
}

export async function editUser(id: string, journalId: string, formData: FormData) {
  const full_name = (formData.get("full_name") as string)?.trim()
  const email = (formData.get("email") as string)?.trim()
  const orcid = (formData.get("orcid") as string)?.trim() || null
  const roles = (formData.getAll("roles") as string[]).filter((r) => ASSIGNABLE_ROLES.has(r))

  if (!full_name) throw new Error("Full name is required")
  if (!email) throw new Error("Email is required")

  // Re-resolve auth_user_id in case email changed or account was created after this person was added
  const authRows = await sql<{ id: string }>(
    `SELECT id FROM public."user" WHERE email = $1`,
    [email]
  )
  const auth_user_id = authRows[0]?.id ?? null

  await sql(
    `UPDATE manuscript.people SET full_name = $1, email = $2, orcid = $3, auth_user_id = $4 WHERE id = $5`,
    [full_name, email, orcid, auth_user_id, id]
  )

  // Replace roles: delete existing, insert new with section assignments
  await sql(
    `DELETE FROM manuscript.person_roles WHERE person_id = $1 AND journal_id = $2`,
    [id, journalId]
  )

  for (const role of roles) {
    const section_id = sectionIdFor(role, formData)
    await sql(
      `INSERT INTO manuscript.person_roles (person_id, journal_id, role, section_id)
       VALUES ($1, $2, $3, $4)`,
      [id, journalId, role, section_id]
    )
  }

  const acronym = await getAcronym(journalId)
  revalidatePath(`/journal/${acronym}/admin/users`)
}
