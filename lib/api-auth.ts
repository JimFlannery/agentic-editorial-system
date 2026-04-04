/**
 * Auth guards for API route handlers.
 * Returns a Response error on failure, null on success.
 * Usage:
 *   const deny = await requireApiSession(req)
 *
 * TODO: Help bot (app/api/help/chat/route.ts)
 *   - Guard: requireApiSession only (any authenticated user)
 *   - No tools passed to Claude — knowledge-only, no DB or graph access
 *   - System prompt contains documentation context, not live system state
 *   - This is the firewall: tool definitions are what give Claude power,
 *     so passing zero tools is sufficient to prevent any data access.
 *   if (deny) return deny
 */

import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/graph"
import type { PersonRole } from "@/lib/auth-helpers"

/**
 * Require a valid session. Returns 401 response if not authenticated.
 */
export async function requireApiSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return { session: null, deny: Response.json({ error: "Unauthenticated" }, { status: 401 }) }
  }
  return { session, deny: null }
}

/**
 * Require system_admin flag. Returns 401/403 response on failure.
 */
export async function requireSystemAdmin() {
  const { session, deny } = await requireApiSession()
  if (deny) return { session: null, deny }
  if (!session!.user.system_admin) {
    return { session: null, deny: Response.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { session: session!, deny: null }
}

/**
 * Require one of the given roles on the specified journal.
 * system_admin bypasses the role check.
 * Returns 401/403 response on failure.
 */
export async function requireJournalRole(journalId: string, allowedRoles: PersonRole[]) {
  const { session, deny } = await requireApiSession()
  if (deny) return { session: null, deny }

  if (session!.user.system_admin) {
    return { session: session!, deny: null }
  }

  const rows = await sql<{ role: string }>(
    `SELECT pr.role::text AS role
     FROM manuscript.people p
     JOIN manuscript.person_roles pr ON pr.person_id = p.id
     WHERE p.auth_user_id = $1
       AND pr.journal_id = $2`,
    [session!.user.id, journalId]
  )

  const roles = rows.map((r) => r.role as PersonRole)
  const allowed = roles.some((r) => allowedRoles.includes(r))

  if (!allowed) {
    return { session: null, deny: Response.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { session: session!, deny: null }
}
