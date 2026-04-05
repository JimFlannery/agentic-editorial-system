import { sql } from "@/lib/graph"
import { AddManuscriptTypeDialog } from "./add-manuscript-type-dialog"

interface ManuscriptType {
  id: string
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

export default async function ManuscriptTypesPage({
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

  const types = await sql<ManuscriptType>(`
    SELECT
      mt.id,
      mt.name,
      mt.acronym,
      mt.description,
      mt.workflow_graph_id,
      mt.display_order,
      mt.active
    FROM manuscript.manuscript_types mt
    WHERE mt.journal_id = $1
    ORDER BY mt.display_order, mt.name
  `, [journal.id])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Manuscript Types</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Define the submission types accepted by each journal. Each type can have its own workflow.
          </p>
        </div>
        <AddManuscriptTypeDialog journalId={journal.id} />
      </div>

      {types.length === 0 ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-border px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground mb-1">No manuscript types defined yet.</p>
            <p className="text-xs text-muted-foreground">
              Add types for each journal to tie them to workflows and submission forms.
            </p>
          </div>

          {/* Common types reference */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Common manuscript types for reference
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {COMMON_TYPES.map((t) => (
                <div
                  key={t.acronym}
                  className="rounded-lg border border-border/50 bg-muted px-3 py-2.5"
                >
                  <span className="inline-block rounded-md bg-muted text-foreground text-xs font-mono font-medium px-1.5 py-0.5 mb-1">
                    {t.acronym}
                  </span>
                  <p className="text-xs text-muted-foreground leading-snug">{t.name}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-20">Acronym</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Description</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Workflow</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-20">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {types.map((t, i) => (
                <tr
                  key={t.id}
                  className={i < types.length - 1 ? "border-b border-border/50" : ""}
                >
                  <td className="px-4 py-3">
                    <span className="inline-block rounded-md bg-muted text-foreground text-xs font-mono font-medium px-2 py-1">
                      {t.acronym}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{t.name}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {t.description ?? <span className="text-border">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {t.workflow_graph_id ? (
                      <a
                        href={`/journal/${acronym}/admin/workflows`}
                        className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
                      >
                        Linked
                      </a>
                    ) : (
                      <a
                        href={`/journal/${acronym}/admin/workflow`}
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
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {t.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <AddManuscriptTypeDialog journalId={journal.id} type={t} />
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
