import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/graph"

export type PersonRole =
  | "author" | "reviewer" | "assistant_editor" | "editor"
  | "editor_in_chief" | "editorial_support" | "journal_admin" | "system_admin"

interface PersonWithRoles {
  id: string
  full_name: string
  roles: PersonRole[]
  system_admin: boolean
}

/**
 * Require a valid session. Redirects to /login if not authenticated.
 */
export async function requireSession(nextPath: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect(`/login?next=${encodeURIComponent(nextPath)}`)
  return session
}

/**
 * Look up the person record and their roles for a specific journal.
 * Returns null if the user has no person record for this journal.
 */
export async function getPersonForJournal(
  authUserId: string,
  journalId: string
): Promise<PersonWithRoles | null> {
  const rows = await sql<{ id: string; full_name: string; roles: string | null }>(
    `SELECT p.id, p.full_name,
            STRING_AGG(pr.role::text, ',' ORDER BY pr.role::text) AS roles
     FROM manuscript.people p
     LEFT JOIN manuscript.person_roles pr
            ON pr.person_id = p.id AND pr.journal_id = $2
     WHERE p.auth_user_id = $1 AND p.journal_id = $2
     GROUP BY p.id, p.full_name`,
    [authUserId, journalId]
  )

  const row = rows[0]
  if (!row) return null

  return {
    id: row.id,
    full_name: row.full_name,
    roles: row.roles ? (row.roles.split(",") as PersonRole[]) : [],
    system_admin: false, // resolved separately if needed
  }
}

interface RoleResult {
  person: PersonWithRoles
  user: { name: string; email: string }
}

/**
 * Require a session AND at least one of the allowed roles for this journal.
 * system_admin bypasses all role checks.
 * Redirects to /login (unauthenticated) or /unauthorized (wrong role).
 * Returns both the person record and the auth user (name + email for UserMenu).
 */
export async function requireRole(
  journalId: string,
  allowedRoles: PersonRole[],
  nextPath: string
): Promise<RoleResult> {
  const session = await requireSession(nextPath)

  // system_admin bypasses all journal-level role checks
  if (session.user.system_admin) {
    return {
      person: {
        id: "system",
        full_name: session.user.name,
        roles: ["system_admin"],
        system_admin: true,
      },
      user: { name: session.user.name, email: session.user.email },
    }
  }

  const person = await getPersonForJournal(session.user.id, journalId)

  if (!person || !person.roles.some((r) => allowedRoles.includes(r))) {
    redirect("/unauthorized")
  }

  return {
    person,
    user: { name: session.user.name, email: session.user.email },
  }
}
