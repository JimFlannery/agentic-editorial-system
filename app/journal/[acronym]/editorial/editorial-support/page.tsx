import Link from "next/link"
import { sql } from "@/lib/graph"

interface ActivityEvent {
  manuscript_id: string
  title: string
  author_name: string
  event_type: string
  occurred_at: string
  summary: string | null
}

interface QuickCount {
  submitted: string
  under_review: string
  revision_requested: string
}

async function getQuickCounts(journalId: string): Promise<QuickCount> {
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
    submitted:          map["submitted"] ?? "0",
    under_review:       map["under_review"] ?? "0",
    revision_requested: map["revision_requested"] ?? "0",
  }
}

async function getRecentActivity(journalId: string): Promise<ActivityEvent[]> {
  return sql<ActivityEvent>(`
    SELECT
      m.id   AS manuscript_id,
      m.title,
      p.full_name AS author_name,
      e.event_type,
      e.occurred_at::text AS occurred_at,
      e.payload->>'summary' AS summary
    FROM history.events e
    JOIN manuscript.manuscripts m ON m.id = e.manuscript_id
    JOIN manuscript.people p ON p.id = m.submitted_by
    WHERE m.journal_id = $1
    ORDER BY e.occurred_at DESC
    LIMIT 20
  `, [journalId])
}

const eventLabels: Record<string, { label: string; cls: string }> = {
  "manuscript.submitted": { label: "Manuscript submitted",  cls: "text-zinc-600 dark:text-zinc-400" },
  "checklist.evaluated":  { label: "Checklist evaluated",   cls: "text-blue-600 dark:text-blue-400" },
  "checklist.passed":     { label: "Passed to editor",      cls: "text-green-600 dark:text-green-400" },
  "reviewer.invited":     { label: "Reviewer invited",      cls: "text-violet-600 dark:text-violet-400" },
  "reviewer.accepted":    { label: "Reviewer accepted",     cls: "text-violet-600 dark:text-violet-400" },
  "reviewer.declined":    { label: "Reviewer declined",     cls: "text-zinc-500 dark:text-zinc-400" },
  "review.submitted":     { label: "Review submitted",      cls: "text-indigo-600 dark:text-indigo-400" },
  "decision.sent":        { label: "Decision sent",         cls: "text-green-600 dark:text-green-400" },
  "revision.submitted":   { label: "Revision submitted",    cls: "text-amber-600 dark:text-amber-400" },
  "manuscript.returned":  { label: "Returned to author",    cls: "text-amber-600 dark:text-amber-400" },
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  })
}

export default async function EditorialSupportPage({
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

  const [counts, activity] = await Promise.all([
    getQuickCounts(journal.id),
    getRecentActivity(journal.id),
  ])

  const quickLinks = [
    { href: `/journal/${acronym}/editorial/queue`,          label: "Checklist Queue",   description: "View and process new submissions" },
    { href: `/journal/${acronym}/admin/users`,              label: "Users",             description: "Manage journal team members and roles" },
    { href: `/journal/${acronym}/admin/email-templates`,    label: "Email Templates",   description: "Review and edit communication templates" },
    { href: `/journal/${acronym}/admin/troubleshooting`,    label: "Troubleshooting",   description: "Diagnose manuscript or workflow issues with Claude" },
  ]

  return (
    <div>
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
        Editorial Support
      </h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
        Author correspondence, administrative tasks, and journal operations for{" "}
        <span className="font-medium text-zinc-700 dark:text-zinc-300">{acronym}</span>.
      </p>

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: "In Checklist Queue",   count: counts.submitted,          href: `/journal/${acronym}/editorial/queue` },
          { label: "Under Review",         count: counts.under_review,       href: `/journal/${acronym}/editorial/queue` },
          { label: "Awaiting Revision",    count: counts.revision_requested, href: `/journal/${acronym}/editorial/queue` },
        ].map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="block rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-4 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
          >
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-1">{stat.count}</p>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{stat.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity feed */}
        <div className="lg:col-span-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800">
            <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Recent Activity</h2>
          </div>

          {activity.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-zinc-400">No activity recorded yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {activity.map((ev, i) => {
                const meta = eventLabels[ev.event_type]
                return (
                  <li key={i}>
                    <Link
                      href={`/journal/${acronym}/editorial/manuscripts/${ev.manuscript_id}`}
                      className="flex items-start gap-3 px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-zinc-900 dark:text-zinc-100 truncate">{ev.title}</p>
                        <p className={`text-xs mt-0.5 ${meta?.cls ?? "text-zinc-500"}`}>
                          {meta?.label ?? ev.event_type.replace(/\./g, " ")}
                        </p>
                        {ev.summary && (
                          <p className="text-xs text-zinc-400 mt-0.5 truncate">{ev.summary}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-zinc-400 whitespace-nowrap">
                        {formatDateTime(ev.occurred_at)}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Quick links */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 px-1">Quick Links</h2>
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
            >
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{link.label}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{link.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
