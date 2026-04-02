import { sql } from "@/lib/graph"

interface PersonRow {
  id: string
  full_name: string
  email: string
  orcid: string | null
  journal_name: string
  roles: string
}

export default async function UsersPage() {
  const people = await sql<PersonRow>(`
    SELECT
      p.id,
      p.full_name,
      p.email,
      p.orcid,
      j.name AS journal_name,
      STRING_AGG(pr.role::text, ', ' ORDER BY pr.role::text) AS roles
    FROM manuscript.people p
    JOIN manuscript.journals j ON j.id = p.journal_id
    LEFT JOIN manuscript.person_roles pr ON pr.person_id = p.id AND pr.journal_id = p.journal_id
    GROUP BY p.id, p.full_name, p.email, p.orcid, j.name
    ORDER BY j.name, p.full_name
  `)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Users</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {people.length} person{people.length !== 1 ? "s" : ""} across all journals
          </p>
        </div>
        <button className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium px-4 py-2 hover:opacity-90 transition-opacity">
          Add user
        </button>
      </div>

      {people.length === 0 ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">No users yet.</p>
      ) : (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Name</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Email</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Journal</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Roles</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">ORCID</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p, i) => (
                <tr
                  key={p.id}
                  className={i < people.length - 1 ? "border-b border-zinc-100 dark:border-zinc-800" : ""}
                >
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{p.full_name}</td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{p.email}</td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{p.journal_name}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {p.roles
                        ? p.roles.split(", ").map((role) => (
                            <span
                              key={role}
                              className="inline-block rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs px-2 py-0.5"
                            >
                              {role.replace(/_/g, " ")}
                            </span>
                          ))
                        : <span className="text-zinc-300 dark:text-zinc-600">—</span>
                      }
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 dark:text-zinc-500 text-xs font-mono">
                    {p.orcid ?? "—"}
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
