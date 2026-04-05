import { notFound } from "next/navigation"
import { sql } from "@/lib/graph"
import { SectionDialog } from "./section-dialog"
import { toggleSection, deleteSection } from "./actions"

interface Section {
  id: string
  name: string
  subject_tags: string[]
  active: boolean
  display_order: number
  member_count: number
}

export default async function SectionsPage({
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
  if (!journal) notFound()

  const sections = await sql<Section>(`
    SELECT
      s.id,
      s.name,
      s.subject_tags,
      s.active,
      s.display_order,
      COUNT(pr.person_id)::int AS member_count
    FROM manuscript.journal_sections s
    LEFT JOIN manuscript.person_roles pr ON pr.section_id = s.id
    WHERE s.journal_id = $1
    GROUP BY s.id, s.name, s.subject_tags, s.active, s.display_order
    ORDER BY s.display_order, s.name
  `, [journal.id])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Sections</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {sections.length} section{sections.length !== 1 ? "s" : ""}
            {" — "}scope editorial staff to specific subject areas
          </p>
        </div>
        <SectionDialog journalId={journal.id} />
      </div>

      <div className="rounded-xl border border-border bg-muted/50 px-4 py-3 mb-4">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">How sections work:</span>{" "}
          Assign a section to an assistant editor or editor in the Users panel. They will only see
          manuscripts whose subject area matches that section&apos;s tags. Staff without a section
          assignment see all manuscripts.
        </p>
      </div>

      {sections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-8 py-12 text-center">
          <p className="text-sm text-muted-foreground mb-4">No sections yet.</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Add sections to divide this journal by subject area.
            Journals without sections show all manuscripts to all editorial staff.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Section</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Subject tags</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Staff</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {sections.map((s, i) => (
                <tr
                  key={s.id}
                  className={i < sections.length - 1 ? "border-b border-border/50" : ""}
                >
                  <td className="px-4 py-3 font-medium text-foreground">
                    {s.name}
                  </td>
                  <td className="px-4 py-3">
                    {s.subject_tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {s.subject_tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-block rounded bg-muted text-muted-foreground text-xs px-1.5 py-0.5 font-mono"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-border text-xs">No tags — manual assignment only</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {s.member_count === 0
                      ? <span className="text-border">—</span>
                      : `${s.member_count} assigned`}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full text-xs px-2 py-0.5 ${
                      s.active
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {s.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <SectionDialog journalId={journal.id} section={s} />
                      <form action={toggleSection.bind(null, journal.id, s.id, !s.active)}>
                        <button
                          type="submit"
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {s.active ? "Deactivate" : "Activate"}
                        </button>
                      </form>
                      {s.member_count === 0 && (
                        <form action={deleteSection.bind(null, journal.id, s.id)}>
                          <button
                            type="submit"
                            className="text-xs text-red-400 hover:text-red-600 transition-colors"
                          >
                            Delete
                          </button>
                        </form>
                      )}
                    </div>
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
