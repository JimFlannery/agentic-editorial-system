"use server"

import { sql } from "@/lib/graph"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"

// All actions on this page require system_admin. Defense in depth — the
// /admin layout already gates the page itself.
async function requireSystemAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error("Not authenticated")
  if (!session.user.system_admin) throw new Error("Forbidden")
  return session
}

const POWER_USER_ROLES = [
  "journal_admin",
  "editor_in_chief",
  "editor",
  "assistant_editor",
  "editorial_support",
] as const

const ALL_ROLES = [
  ...POWER_USER_ROLES,
  "reviewer",
  "author",
] as const

export type AssignableRole = (typeof ALL_ROLES)[number]

function isAssignableRole(value: string): value is AssignableRole {
  return (ALL_ROLES as readonly string[]).includes(value)
}

// ---------------------------------------------------------------------------
// Toggle system_admin on a Better Auth user.
// Refuses to demote the last remaining system admin.
// ---------------------------------------------------------------------------
export async function setSystemAdmin(userId: string, value: boolean) {
  const session = await requireSystemAdmin()

  if (!value) {
    const [{ count }] = await sql<{ count: string }>(
      'SELECT count(*)::text AS count FROM "user" WHERE system_admin = true AND id <> $1',
      [userId]
    )
    if (parseInt(count, 10) === 0) {
      throw new Error("Cannot demote the last remaining system admin")
    }
  }

  // Allow self-demotion only if another admin exists (covered by the guard
  // above). No other restriction — system admins manage themselves and peers.
  await sql(
    'UPDATE "user" SET system_admin = $2 WHERE id = $1',
    [userId, value]
  )

  // Touch the session check side effect: if the current admin demoted
  // themselves, the next page load will redirect them out of /admin.
  void session

  revalidatePath("/admin/users")
}

// ---------------------------------------------------------------------------
// Grant a role to a Better Auth user on a specific journal.
//
// Looks up (or creates) a manuscript.people row for (auth_user_id, journal_id),
// then INSERTs the person_roles row. Idempotent on the role grant via the
// UNIQUE (person_id, journal_id, role) constraint.
// ---------------------------------------------------------------------------
export async function grantRole(
  authUserId: string,
  journalId: string,
  role: string
) {
  await requireSystemAdmin()

  if (!isAssignableRole(role)) {
    throw new Error(`Unknown role: ${role}`)
  }

  // Pull name + email from Better Auth — needed if we have to create the
  // people row from scratch.
  const userRows = await sql<{ name: string; email: string }>(
    'SELECT name, email FROM "user" WHERE id = $1',
    [authUserId]
  )
  if (userRows.length === 0) throw new Error("User not found")
  const { name, email } = userRows[0]

  // Verify the journal exists.
  const journalRows = await sql<{ id: string }>(
    "SELECT id FROM manuscript.journals WHERE id = $1",
    [journalId]
  )
  if (journalRows.length === 0) throw new Error("Journal not found")

  // Look for an existing people row for this user on this journal.
  const existing = await sql<{ id: string }>(
    "SELECT id FROM manuscript.people WHERE auth_user_id = $1 AND journal_id = $2",
    [authUserId, journalId]
  )

  let personId: string
  if (existing.length > 0) {
    personId = existing[0].id
  } else {
    // Try to claim an unlinked seed row with the same email on this journal,
    // before creating a fresh row.
    const claimable = await sql<{ id: string }>(
      `SELECT id FROM manuscript.people
        WHERE journal_id = $1
          AND LOWER(email) = LOWER($2)
          AND auth_user_id IS NULL
        LIMIT 1`,
      [journalId, email]
    )

    if (claimable.length > 0) {
      personId = claimable[0].id
      await sql(
        "UPDATE manuscript.people SET auth_user_id = $1 WHERE id = $2",
        [authUserId, personId]
      )
    } else {
      const inserted = await sql<{ id: string }>(
        `INSERT INTO manuscript.people (journal_id, email, full_name, auth_user_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [journalId, email, name, authUserId]
      )
      personId = inserted[0].id
    }
  }

  // Insert the role. ON CONFLICT makes the operation idempotent.
  await sql(
    `INSERT INTO manuscript.person_roles (person_id, journal_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (person_id, journal_id, role) DO NOTHING`,
    [personId, journalId, role]
  )

  revalidatePath("/admin/users")
}

// ---------------------------------------------------------------------------
// Revoke a single person_roles row by id.
// ---------------------------------------------------------------------------
export async function revokeRole(personRoleId: string) {
  await requireSystemAdmin()

  await sql(
    "DELETE FROM manuscript.person_roles WHERE id = $1",
    [personRoleId]
  )

  revalidatePath("/admin/users")
}
