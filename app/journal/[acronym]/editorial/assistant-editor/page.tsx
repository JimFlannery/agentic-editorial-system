import Link from "next/link"
import { sql } from "@/lib/graph"

interface QueueCounts {
  submitted: string
  under_review: string
  revision_requested: string
}

interface RecentManuscript {
  id: string
  title: string
  manuscript_type: string
  author_name: string
  submitted_at: string
  checklist_overall: string | null
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
  for (const row of rows) map[row.status] = row.count
  return {
    submitted: map["submitted"] ?? "0",
    under_review: map["under_review"] ?? "0",
    revision_requested: map["revision_requested"] ?? "0",
  }
}

async function getRecentQueue(journalId: string): Promise<RecentManuscript[]> {
  return sql<RecentManuscript>(`
    SELECT
      m.id,
      m.title,
      m.manuscript_type,
      p.full_name AS author_name,
      m.submitted_at::text AS submitted_at,
      chk.payload->>'overall' AS checklist_overall
    FROM manuscript.manuscripts m
    JOIN manuscript.people p ON p.id = m.submitted_by
    LEFT JOIN LATERAL (
      SELECT payload
      FROM history.events
      WHERE manuscript_id = m.id
        AND event_type = 'checklist.evaluated'
      ORDER BY occurred_at DESC
      LIMIT 1
    ) chk ON true
    WHERE m.status = 'submitted'
      AND m.journal_id = $1
    ORDER BY m.submitted_at ASC
    LIMIT 8
  `, [journalId])
}

const checklistBadge: Record<string, { label: string; cls: string }> = {
  pass:               { label: "Pass",         cls: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" },
  fail:               { label: "Fail",         cls: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
  needs_human_review: { label: "Needs review", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function daysAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return "today"
  if (days === 1) return "yesterday"
  return `${days}d ago`
}

export default async function AssistantEditorPage({
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
  const [counts, queue] = await Promise.all([
    getQueueCounts(journal.id),
    getRecentQueue(journal.id),
  ])

  const stats = [
    {
      label: "Awaiting Checklist",
      count: counts.submitted,
      href: `/journal/${acronym}/editorial/queue`,
      urgent: parseInt(counts.submitted) > 0,
      description: "New submissions needing the admin checklist before moving to an editor.",
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
        Assistant Editor
      </h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
        Manage incoming submissions, run admin checklists, and route manuscripts to the editorial team.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
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

      {/* Checklist queue */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Checklist Queue</h2>
          <Link
            href={`/journal/${acronym}/editorial/queue`}
            className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            View all →
          </Link>
        </div>

        {queue.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-zinc-400">All caught up — no submissions in the queue.</p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {queue.map((ms) => {
              const badge = ms.checklist_overall ? checklistBadge[ms.checklist_overall] : null
              return (
                <li key={ms.id}>
                  <Link
                    href={`/journal/${acronym}/editorial/manuscripts/${ms.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-zinc-900 dark:text-zinc-100 truncate">{ms.title}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {ms.author_name} · {ms.manuscript_type.replace(/_/g, " ")} · submitted {daysAgo(ms.submitted_at)}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {badge ? (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${badge.cls}`}>
                          {badge.label}
                        </span>
                      ) : (
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                          Not evaluated
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
