import Link from "next/link"
import { sql } from "@/lib/graph"

interface QueueCounts {
  submitted: string
  under_review: string
  revision_requested: string
}

async function getQueueCounts(journalId: string): Promise<QueueCounts> {
  const rows = await sql<{ status: string; count: string }>(
    `SELECT status, COUNT(*) as count
     FROM manuscript.manuscripts
     WHERE journal_id = $1
     GROUP BY status`,
    [journalId]
  )
  const map: Record<string, string> = {}
  for (const row of rows) {
    map[row.status] = row.count
  }
  return {
    submitted: map["submitted"] ?? "0",
    under_review: map["under_review"] ?? "0",
    revision_requested: map["revision_requested"] ?? "0",
  }
}

export default async function JournalAdminDashboardPage({
  params,
}: {
  params: Promise<{ acronym: string }>
}) {
  const { acronym } = await params

  const [journalRows] = await Promise.all([
    sql<{ id: string; name: string }>(
      "SELECT id, name FROM manuscript.journals WHERE UPPER(acronym) = UPPER($1)",
      [acronym]
    ),
  ])
  const journal = journalRows[0]
  const counts = await getQueueCounts(journal.id)

  const stats = [
    {
      label: "Awaiting Checklist",
      count: counts.submitted,
      href: `/journal/${acronym}/editorial/queue`,
      urgent: parseInt(counts.submitted) > 0,
      description: "Newly submitted manuscripts that need the admin checklist completed before moving to the EIC.",
    },
    {
      label: "Under Review",
      count: counts.under_review,
      href: `/journal/${acronym}/editorial/queue`,
      urgent: false,
      description: "Manuscripts currently with reviewers.",
    },
    {
      label: "Awaiting Revision",
      count: counts.revision_requested,
      href: `/journal/${acronym}/editorial/queue`,
      urgent: false,
      description: "Manuscripts returned to authors for revision.",
    },
  ]

  return (
    <div>
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
        Journal Admin Center
      </h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
        Manage incoming submissions, run admin checklists, and route manuscripts to the editorial team.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="block rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-4 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
          >
            <div className="flex items-baseline gap-2 mb-1">
              <span className={`text-2xl font-bold ${stat.urgent ? "text-amber-600 dark:text-amber-400" : "text-zinc-900 dark:text-zinc-100"}`}>
                {stat.count}
              </span>
              {stat.urgent && (
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-1.5 py-0.5 rounded">
                  Action needed
                </span>
              )}
            </div>
            <p className="font-medium text-zinc-900 dark:text-zinc-100 text-sm mb-1">{stat.label}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{stat.description}</p>
          </Link>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-4">
        <h2 className="font-medium text-zinc-900 dark:text-zinc-100 text-sm mb-1">Admin Checklist</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed mb-3">
          Each submitted manuscript must pass the admin checklist before being sent to the Editor-in-Chief.
          AI assistance evaluates each item automatically — borderline cases are flagged for human review.
        </p>
        <ul className="space-y-1">
          {[
            "Figure format meets requirements (300 dpi)",
            "Conflict of interest form submitted (if applicable)",
            "IRB / ethics requirements verified (if applicable)",
            "Cover letter submitted",
            "All author and institution information complete",
          ].map((item) => (
            <li key={item} className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <Link
            href={`/journal/${acronym}/editorial/queue`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            Open checklist queue →
          </Link>
        </div>
      </div>
    </div>
  )
}
