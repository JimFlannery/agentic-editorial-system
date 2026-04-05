import { sql } from "@/lib/graph"
import { AddUserDialog } from "./add-user-dialog"

interface PersonRow {
  id: string
  full_name: string
  email: string
  orcid: string | null
  journal_id: string
  roles: string | null
  role_sections: Record<string, string | null> | null  // role -> section_id
}

interface Section {
  id: string
  name: string
}

export default async function UsersPage({
  params,
}: {
  params: Promise<{ acronym: string }>
}) {
  const { acronym } = await params

  const journalRows = await sql<{ id: string; name: string }>(
    "SELECT id, name FROM manuscript.journals WHERE UPPER(acronym) = UPPER($1)",
    [acronym]
  )
  const journal = journalRows[0]

  const [people, sections] = await Promise.all([
    sql<PersonRow>(`
      SELECT
        p.id,
        p.full_name,
        p.email,
        p.orcid,
        p.journal_id,
        STRING_AGG(pr.role::text, ', ' ORDER BY pr.role::text) AS roles,
        JSONB_OBJECT_AGG(pr.role::text, pr.section_id)
          FILTER (WHERE pr.role IS NOT NULL) AS role_sections
      FROM manuscript.people p
      LEFT JOIN manuscript.person_roles pr ON pr.person_id = p.id AND pr.journal_id = p.journal_id
      WHERE p.journal_id = $1
      GROUP BY p.id, p.full_name, p.email, p.orcid, p.journal_id
      ORDER BY p.full_name
    `, [journal.id]),
    sql<Section>(`
      SELECT id, name
      FROM manuscript.journal_sections
      WHERE journal_id = $1 AND active = true
      ORDER BY display_order, name
    `, [journal.id]),
  ])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {people.length} person{people.length !== 1 ? "s" : ""} in {journal.name}
          </p>
        </div>
        <AddUserDialog journalId={journal.id} sections={sections} />
      </div>

      {people.length === 0 ? (
        <p className="text-sm text-muted-foreground">No users yet.</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Roles</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">ORCID</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {people.map((p, i) => (
                <tr
                  key={p.id}
                  className={i < people.length - 1 ? "border-b border-border/50" : ""}
                >
                  <td className="px-4 py-3 font-medium text-foreground">{p.full_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {p.roles
                        ? p.roles.split(", ").map((role) => {
                            const sectionId = p.role_sections?.[role]
                            const sectionName = sectionId
                              ? sections.find((s) => s.id === sectionId)?.name
                              : null
                            return (
                              <span
                                key={role}
                                className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground text-xs px-2 py-0.5"
                              >
                                {role.replace(/_/g, " ")}
                                {sectionName && (
                                  <span className="text-muted-foreground">· {sectionName}</span>
                                )}
                              </span>
                            )
                          })
                        : <span className="text-border">—</span>
                      }
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs font-mono">
                    {p.orcid ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <AddUserDialog journalId={journal.id} person={p} sections={sections} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
