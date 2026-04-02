import { sql } from "@/lib/graph"

interface ManuscriptType {
  id: string
  journal_name: string
  name: string
  acronym: string
  description: string | null
  workflow_graph_id: string | null
  display_order: number
  active: boolean
}

// Common manuscript types to suggest when adding new ones (not pre-seeded — just UI hints)
const COMMON_TYPES = [
  { name: "Original Research", acronym: "OR" },
  { name: "Review Article", acronym: "RA" },
  { name: "Systematic Review", acronym: "SR" },
  { name: "Meta-Analysis", acronym: "MA" },
  { name: "Case Report", acronym: "CR" },
  { name: "Letter", acronym: "L" },
  { name: "Editorial", acronym: "ED" },
  { name: "Commentary", acronym: "COM" },
  { name: "Brief Communication", acronym: "BC" },
  { name: "Correction", acronym: "COR" },
]

export default async function ManuscriptTypesPage() {
  const types = await sql<ManuscriptType>(`
    SELECT
      mt.id,
      j.name AS journal_name,
      mt.name,
      mt.acronym,
      mt.description,
      mt.workflow_graph_id,
      mt.display_order,
      mt.active
    FROM manuscript.manuscript_types mt
    JOIN manuscript.journals j ON j.id = mt.journal_id
    ORDER BY j.name, mt.display_order, mt.name
  `)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Manuscript Types</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Define the submission types accepted by each journal. Each type can have its own workflow.
          </p>
        </div>
        <button className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium px-4 py-2 hover:opacity-90 transition-opacity">
          Add type
        </button>
      </div>

      {types.length === 0 ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 px-6 py-10 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">No manuscript types defined yet.</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Add types for each journal to tie them to workflows and submission forms.
            </p>
          </div>

          {/* Common types reference */}
          <div>
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">
              Common manuscript types for reference
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {COMMON_TYPES.map((t) => (
                <div
                  key={t.acronym}
                  className="rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-2.5"
                >
                  <span className="inline-block rounded-md bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-mono font-medium px-1.5 py-0.5 mb-1">
                    {t.acronym}
                  </span>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-snug">{t.name}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 w-20">Acronym</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Name</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Journal</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Description</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Workflow</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 w-20">Status</th>
              </tr>
            </thead>
            <tbody>
              {types.map((t, i) => (
                <tr
                  key={t.id}
                  className={i < types.length - 1 ? "border-b border-zinc-100 dark:border-zinc-800" : ""}
                >
                  <td className="px-4 py-3">
                    <span className="inline-block rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-mono font-medium px-2 py-1">
                      {t.acronym}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{t.name}</td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{t.journal_name}</td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 text-xs">
                    {t.description ?? <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {t.workflow_graph_id ? (
                      <a
                        href="/admin/workflows"
                        className="text-zinc-600 dark:text-zinc-400 underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100"
                      >
                        Linked
                      </a>
                    ) : (
                      <a
                        href="/admin/workflow"
                        className="text-amber-600 dark:text-amber-400 underline underline-offset-2"
                      >
                        Not linked
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full text-xs px-2 py-0.5 font-medium ${
                        t.active
                          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500"
                      }`}
                    >
                      {t.active ? "Active" : "Inactive"}
                    </span>
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
