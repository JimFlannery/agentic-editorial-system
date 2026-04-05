import Link from "next/link"
import { sql } from "@/lib/graph"

interface StatusCounts {
  under_review: string
  revision_requested: string
  submitted: string
}

interface ActiveManuscript {
  id: string
  title: string
  manuscript_type: string
  author_name: string
  status: string
  submitted_at: string
  last_event_at: string | null
  last_event_type: string | null
}

interface RecentDecision {
  manuscript_id: string
  title: string
  author_name: string
  occurred_at: string
  decision: string | null
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
  for (const row of rows) map[row.status] = row.count
  return {
    under_review:      map["under_review"] ?? "0",
    revision_requested: map["revision_requested"] ?? "0",
    submitted:         map["submitted"] ?? "0",
  }
}

async function getActiveManuscripts(journalId: string): Promise<ActiveManuscript[]> {
  return sql<ActiveManuscript>(`
    SELECT
      m.id,
      m.title,
      m.manuscript_type,
      p.full_name AS author_name,
      m.status,
      m.submitted_at::text AS submitted_at,
      ev.occurred_at::text AS last_event_at,
      ev.event_type        AS last_event_type
    FROM manuscript.manuscripts m
    JOIN manuscript.people p ON p.id = m.submitted_by
    LEFT JOIN LATERAL (
      SELECT occurred_at, event_type
      FROM history.events
      WHERE manuscript_id = m.id
      ORDER BY occurred_at DESC
      LIMIT 1
    ) ev ON true
    WHERE m.journal_id = $1
      AND m.status IN ('under_review', 'revision_requested')
    ORDER BY m.submitted_at ASC
    LIMIT 10
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
    LIMIT 5
  `, [journalId])
}

const statusLabel: Record<string, { label: string; cls: string }> = {
  under_review:       { label: "Under review",      cls: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800" },
  revision_requested: { label: "Awaiting revision",  cls: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300 border border-violet-200 dark:border-violet-800" },
}

function daysAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return "today"
  if (days === 1) return "yesterday"
  return `${days}d ago`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default async function EditorPage({
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

  const [counts, manuscripts, decisions] = await Promise.all([
    getStatusCounts(journal.id),
    getActiveManuscripts(journal.id),
    getRecentDecisions(journal.id),
  ])

  const stats = [
    {
      label: "Under Review",
      count: counts.under_review,
      urgent: false,
      description: "Manuscripts currently with reviewers. Track progress and watch for late reviews.",
    },
    {
      label: "Awaiting Revision",
      count: counts.revision_requested,
      urgent: parseInt(counts.revision_requested) > 0,
      description: "Revision requests sent to authors. Revisions will return here when submitted.",
    },
    {
      label: "In Checklist Queue",
      count: counts.submitted,
      urgent: false,
      description: "New submissions being processed by the Assistant Editor.",
    },
  ]

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-1">
        Editor
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        Review manuscripts, evaluate reviewer reports, and make editorial decisions for{" "}
        <span className="font-medium text-foreground">{acronym}</span>.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-card px-5 py-4"
          >
            <div className="flex items-baseline gap-2 mb-1">
              <span className={`text-2xl font-bold ${stat.urgent ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
                {stat.count}
              </span>
              {stat.urgent && (
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-1.5 py-0.5 rounded">
                  Action needed
                </span>
              )}
            </div>
            <p className="font-medium text-foreground text-sm mb-1">{stat.label}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{stat.description}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active manuscripts */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
            <h2 className="text-sm font-medium text-foreground">Active Manuscripts</h2>
          </div>

          {manuscripts.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-muted-foreground">No manuscripts currently under review or awaiting revision.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/50">
              {manuscripts.map((ms) => {
                const badge = statusLabel[ms.status]
                return (
                  <li key={ms.id}>
                    <Link
                      href={`/journal/${acronym}/editorial/manuscripts/${ms.id}`}
                      className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-foreground truncate">{ms.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {ms.author_name} · {ms.manuscript_type.replace(/_/g, " ")}
                          {ms.last_event_at && (
                            <> · last activity {daysAgo(ms.last_event_at)}</>
                          )}
                        </p>
                      </div>
                      {badge && (
                        <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded ${badge.cls}`}>
                          {badge.label}
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Recent decisions */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border/50">
            <h2 className="text-sm font-medium text-foreground">Recent Decisions</h2>
          </div>

          {decisions.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-muted-foreground">No decisions sent yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/50">
              {decisions.map((d) => (
                <li key={`${d.manuscript_id}-${d.occurred_at}`}>
                  <Link
                    href={`/journal/${acronym}/editorial/manuscripts/${d.manuscript_id}`}
                    className="block px-5 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <p className="text-sm text-foreground truncate">{d.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
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
