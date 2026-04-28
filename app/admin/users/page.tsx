import { sql } from "@/lib/graph"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { setSystemAdmin, revokeRole } from "./actions"
import { AddRoleDialog } from "./add-role-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface RoleEntry {
  person_role_id: string
  journal_id: string
  journal_acronym: string | null
  journal_name: string
  role: string
}

interface UserRow {
  id: string
  name: string
  email: string
  system_admin: boolean
  roles: RoleEntry[]
}

interface JournalOption {
  id: string
  name: string
  acronym: string | null
}

const POWER_USER_ROLES = [
  "journal_admin",
  "editor_in_chief",
  "editor",
  "assistant_editor",
  "editorial_support",
]

const FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "power", label: "Power users (default)" },
  { value: "all", label: "All users" },
  { value: "system_admin", label: "System admins only" },
  { value: "journal_admin", label: "Journal admins" },
  { value: "editor_in_chief", label: "Editors-in-chief" },
  { value: "editor", label: "Editors" },
  { value: "assistant_editor", label: "Assistant editors" },
  { value: "editorial_support", label: "Editorial support" },
  { value: "reviewer", label: "Reviewers" },
  { value: "author", label: "Authors" },
]

function formatRole(role: string): string {
  return role.replace(/_/g, " ")
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  const currentUserId = session?.user.id ?? null

  const params = await searchParams
  const search = params.q?.trim() ?? ""
  const roleFilter = params.role ?? "power"

  // Build filter clause + parameter list
  const whereClauses: string[] = []
  const queryParams: unknown[] = []

  if (search) {
    queryParams.push(`%${search}%`)
    const idx = queryParams.length
    whereClauses.push(`(u.name ILIKE $${idx} OR u.email ILIKE $${idx})`)
  }

  if (roleFilter === "system_admin") {
    whereClauses.push("u.system_admin = true")
  } else if (roleFilter === "power") {
    queryParams.push(POWER_USER_ROLES)
    const idx = queryParams.length
    whereClauses.push(`(
      u.system_admin = true
      OR EXISTS (
        SELECT 1 FROM manuscript.person_roles pr2
        JOIN manuscript.people p2 ON p2.id = pr2.person_id
        WHERE p2.auth_user_id = u.id AND pr2.role::text = ANY($${idx}::text[])
      )
    )`)
  } else if (roleFilter !== "all") {
    queryParams.push(roleFilter)
    const idx = queryParams.length
    whereClauses.push(`EXISTS (
      SELECT 1 FROM manuscript.person_roles pr2
      JOIN manuscript.people p2 ON p2.id = pr2.person_id
      WHERE p2.auth_user_id = u.id AND pr2.role::text = $${idx}
    )`)
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : ""

  const users = await sql<UserRow>(
    `
    WITH user_roles AS (
      SELECT
        p.auth_user_id,
        json_agg(
          json_build_object(
            'person_role_id', pr.id,
            'journal_id', j.id,
            'journal_acronym', j.acronym,
            'journal_name', j.name,
            'role', pr.role::text
          ) ORDER BY j.acronym, pr.role::text
        ) AS roles
      FROM manuscript.person_roles pr
      JOIN manuscript.people p ON p.id = pr.person_id
      JOIN manuscript.journals j ON j.id = pr.journal_id
      WHERE p.auth_user_id IS NOT NULL
      GROUP BY p.auth_user_id
    )
    SELECT
      u.id,
      u.name,
      u.email,
      u.system_admin,
      COALESCE(ur.roles, '[]'::json) AS roles
    FROM "user" u
    LEFT JOIN user_roles ur ON ur.auth_user_id = u.id
    ${whereSql}
    ORDER BY u.system_admin DESC, u.name
    `,
    queryParams
  )

  const journals = await sql<JournalOption>(
    "SELECT id, name, acronym FROM manuscript.journals ORDER BY name"
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Users</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage system admins and editorial roles across all journals.
        </p>
      </div>

      <form
        method="GET"
        className="flex flex-wrap items-end gap-3 mb-6 p-4 rounded-xl border border-border bg-muted/30"
        aria-label="Filter users"
      >
        <div className="flex-1 min-w-[200px] space-y-1.5">
          <Label htmlFor="q">Search by name or email</Label>
          <Input id="q" name="q" type="search" placeholder="e.g. jane or @example.org" defaultValue={search} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="role">Filter</Label>
          <select
            id="role"
            name="role"
            defaultValue={roleFilter}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <Button type="submit">Apply</Button>
      </form>

      <p className="text-xs text-muted-foreground mb-3">
        {users.length} user{users.length !== 1 ? "s" : ""}
      </p>

      {users.length === 0 ? (
        <p className="text-sm text-muted-foreground">No users match this filter.</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">System admin</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Journal roles</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => {
                const isCurrentUser = u.id === currentUserId
                return (
                  <tr
                    key={u.id}
                    className={i < users.length - 1 ? "border-b border-border/50" : ""}
                  >
                    <td className="px-4 py-3 font-medium text-foreground align-top">
                      {u.name}
                      {isCurrentUser && (
                        <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground align-top">{u.email}</td>
                    <td className="px-4 py-3 align-top">
                      <form action={async () => {
                        "use server"
                        await setSystemAdmin(u.id, !u.system_admin)
                      }}>
                        <button
                          type="submit"
                          className={
                            u.system_admin
                              ? "inline-flex items-center rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs px-2 py-0.5 hover:bg-indigo-200 dark:hover:bg-indigo-900 transition-colors"
                              : "inline-flex items-center rounded-full bg-muted text-muted-foreground text-xs px-2 py-0.5 hover:bg-muted/70 transition-colors"
                          }
                          aria-label={
                            u.system_admin
                              ? `Revoke system admin from ${u.name}`
                              : `Grant system admin to ${u.name}`
                          }
                        >
                          {u.system_admin ? "Yes — click to revoke" : "No — click to grant"}
                        </button>
                      </form>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.length === 0 ? (
                          <span className="text-border">—</span>
                        ) : (
                          u.roles.map((r) => (
                            <form
                              key={r.person_role_id}
                              action={async () => {
                                "use server"
                                await revokeRole(r.person_role_id)
                              }}
                            >
                              <button
                                type="submit"
                                className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground text-xs px-2 py-0.5 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-950 dark:hover:text-red-300 transition-colors"
                                aria-label={`Revoke ${r.role.replace(/_/g, " ")} on ${r.journal_acronym ?? r.journal_name} from ${u.name}`}
                                title="Click to revoke"
                              >
                                <span className="font-semibold">{r.journal_acronym ?? r.journal_name}</span>
                                <span>·</span>
                                <span>{formatRole(r.role)}</span>
                                <span aria-hidden="true" className="ml-0.5">×</span>
                              </button>
                            </form>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <AddRoleDialog
                        userId={u.id}
                        userName={u.name}
                        journals={journals}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
