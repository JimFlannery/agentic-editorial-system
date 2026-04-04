import Link from "next/link"
import { sql } from "@/lib/graph"

interface StatusCounts {
  submitted: string
  under_review: string
  revision_requested: string
  total: string
}

interface StalledManuscript {
  id: string
  title: string
  manuscript_type: string
  author_name: string
  status: string
  submitted_at: string
  last_event_at: string | null
  days_stalled: number
}

interface RecentDecision {
  manuscript_id: string
  title: string
  author_name: string
  occurred_at: string
  decision: string | null
}

interface MonthlyMetric {
  submissions_this_month: string
  avg_days_to_decision: string | null
}

async function getStatusCounts(journalId: string): Promise<StatusCounts> {
  const rows = await sql<{ status: string; count: string }>(
    `SELECT status, COUNT(*) as count
     FROM manuscript.manuscripts
     WHERE journal_id = $1
     GROUP BY status`,
    [journalId]
  )
  const map: Record<string, string> = {}
  let total = 0
  for (const row of rows) {
    map[row.status] = row.count
    total += parseInt(row.count)
  }
  return {
    submitted:          map["submitted"] ?? "0",
    under_review:       map["under_review"] ?? "0",
    revision_requested: map["revision_requested"] ?? "0",
    total:              String(total),
  }
}

async function getStalledManuscripts(journalId: string): Promise<StalledManuscript[]> {
  return sql<StalledManuscript>(`
    SELECT
      m.id,
      m.title,
      m.manuscript_type,
      p.full_name    AS author_name,
      m.status,
      m.submitted_at::text AS submitted_at,
      ev.occurred_at::text AS last_event_at,
      EXTRACT(DAY FROM now() - COALESCE(ev.occurred_at, m.submitted_at))::int AS days_stalled
    FROM manuscript.manuscripts m
    JOIN manuscript.people p ON p.id = m.submitted_by
    LEFT JOIN LATERAL (
      SELECT occurred_at
      FROM history.events
      WHERE manuscript_id = m.id
      ORDER BY occurred_at DESC
      LIMIT 1
    ) ev ON true
    WHERE m.journal_id = $1
      AND m.status NOT IN ('accepted', 'rejected')
      AND COALESCE(ev.occurred_at, m.submitted_at) < now() - INTERVAL '14 days'
    ORDER BY days_stalled DESC
    LIMIT 8
  `, [journalId])
}

async function getRecentDecisions(journalId: string): Promise<RecentDecision[]> {
  return sql<RecentDecision>(`
    SELECT
      m.id   AS manuscript_id,
      m.title,
      p.full_name AS author_name,
      e.occurred_at::text AS occurred_at,
      e.payload->>'decision' AS decision
    FROM history.events e
    JOIN manuscript.manuscripts m ON m.id = e.manuscript_id
    JOIN manuscript.people p ON p.id = m.submitted_by
    WHERE e.event_type = 'decision.sent'
      AND m.journal_id = $1
    ORDER BY e.occurred_at DESC
    LIMIT 8
  `, [journalId])
}

async function getMonthlyMetrics(journalId: string): Promise<MonthlyMetric> {
  const rows = await sql<MonthlyMetric>(`
    SELECT
      COUNT(*)::text AS submissions_this_month,
      NULL::text     AS avg_days_to_decision
    FROM manuscript.manuscripts
    WHERE journal_id = $1
      AND submitted_at >= date_trunc('month', now())
  `, [journalId])
  return rows[0] ?? { submissions_this_month: "0", avg_days_to_decision: null }
}

const statusLabel: Record<string, string> = {
  submitted:          "checklist queue",
  under_review:       "under review",
  revision_requested: "awaiting revision",
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default async function EditorInChiefPage({
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

  const [counts, stalled, decisions, metrics] = await Promise.all([
    getStatusCounts(journal.id),
    getStalledManuscripts(journal.id),
    getRecentDecisions(journal.id),
    getMonthlyMetrics(journal.id),
  ])

  const stats = [
    { label: "Checklist Queue",   count: counts.submitted,          urgent: parseInt(counts.submitted) > 5 },
    { label: "Under Review",      count: counts.under_review,       urgent: false },
    { label: "Awaiting Revision", count: counts.revision_requested, urgent: false },
    { label: "Stalled (14d+)",    count: String(stalled.length),    urgent: stalled.length > 0 },
  ]

  return (
    <div>
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
        Editor-in-Chief
      </h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
        Editorial oversight, escalations, and final decisions for{" "}
        <span className="font-medium text-zinc-700 dark:text-zinc-300">{acronym}</span>.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-4"
          >
            <div className="flex items-baseline gap-2 mb-1">
              <span className={`text-2xl font-bold ${stat.urgent ? "text-amber-600 dark:text-amber-400" : "text-zinc-900 dark:text-zinc-100"}`}>
                {stat.count}
              </span>
              {stat.urgent && (
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-1.5 py-0.5 rounded">
                  Attention
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Monthly at-a-glance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-4">
          <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Submissions this month</p>
          <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{metrics.submissions_this_month}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-4">
          <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Avg. days to decision</p>
          <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            {metrics.avg_days_to_decision ?? "—"}
          </p>
          <p className="text-xs text-zinc-400 mt-1">Calculated once decisions are recorded</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stalled manuscripts */}
        <div className="lg:col-span-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800">
            <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Stalled Manuscripts
              <span className="ml-2 text-xs font-normal text-zinc-400">no activity in 14+ days</span>
            </h2>
          </div>

          {stalled.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-zinc-400">No stalled manuscripts — all submissions have recent activity.</p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {stalled.map((ms) => (
                <li key={ms.id}>
                  <Link
                    href={`/journal/${acronym}/editorial/manuscripts/${ms.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-zinc-900 dark:text-zinc-100 truncate">{ms.title}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {ms.author_name} · {statusLabel[ms.status] ?? ms.status.replace(/_/g, " ")}
                      </p>
                    </div>
                    <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded ${ms.days_stalled > 30 ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"}`}>
                      {ms.days_stalled}d
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent decisions */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800">
            <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Recent Decisions</h2>
          </div>

          {decisions.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-zinc-400">No decisions sent yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {decisions.map((d) => (
                <li key={`${d.manuscript_id}-${d.occurred_at}`}>
                  <Link
                    href={`/journal/${acronym}/editorial/manuscripts/${d.manuscript_id}`}
                    className="block px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <p className="text-sm text-zinc-900 dark:text-zinc-100 truncate">{d.title}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {d.decision ?? "decision sent"} · {formatDate(d.occurred_at)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
