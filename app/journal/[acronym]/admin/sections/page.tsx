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
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Sections</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {sections.length} section{sections.length !== 1 ? "s" : ""}
            {" — "}scope editorial staff to specific subject areas
          </p>
        </div>
        <SectionDialog journalId={journal.id} />
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-3 mb-4">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">How sections work:</span>{" "}
          Assign a section to an assistant editor or editor in the Users panel. They will only see
          manuscripts whose subject area matches that section&apos;s tags. Staff without a section
          assignment see all manuscripts.
        </p>
      </div>

      {sections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 px-8 py-12 text-center">
          <p className="text-sm text-zinc-400 mb-4">No sections yet.</p>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Add sections to divide this journal by subject area.
            Journals without sections show all manuscripts to all editorial staff.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Section</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Subject tags</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Staff</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {sections.map((s, i) => (
                <tr
                  key={s.id}
                  className={i < sections.length - 1 ? "border-b border-zinc-100 dark:border-zinc-800" : ""}
                >
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                    {s.name}
                  </td>
                  <td className="px-4 py-3">
                    {s.subject_tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {s.subject_tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-block rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs px-1.5 py-0.5 font-mono"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-zinc-300 dark:text-zinc-600 text-xs">No tags — manual assignment only</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                    {s.member_count === 0
                      ? <span className="text-zinc-300 dark:text-zinc-600">—</span>
                      : `${s.member_count} assigned`}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full text-xs px-2 py-0.5 ${
                      s.active
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
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
                          className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
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
