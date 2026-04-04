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

  const base = `/journal/${acronym}/admin`

  const sections = [
    {
      href: `${base}/manuscript-types`,
      title: "Manuscript Types",
      description: "Define submission types for this journal (Original Research, Review Article, etc.) and link each to a workflow.",
    },
    {
      href: `${base}/form-fields`,
      title: "Form Fields",
      description: "Control which fields appear on the author submission form — toggle standard fields, add custom questions, and drag to reorder.",
    },
    {
      href: `${base}/workflows`,
      title: "Workflows",
      description: "View workflow definitions for this journal, rendered as numbered step lists with gate branching shown inline.",
    },
    {
      href: `${base}/workflow`,
      title: "Workflow Config",
      description: "Use the AI assistant to modify workflows in plain language. Describe the change — Claude stages it for your confirmation before committing.",
    },
    {
      href: `${base}/email-templates`,
      title: "Email Templates",
      description: "Manage reusable email templates for reviewer invitations, decision letters, reminders, and other workflow communications.",
    },
    {
      href: `${base}/users`,
      title: "Users",
      description: "Manage people with roles on this journal — add team members, edit role assignments, and deactivate access.",
    },
    {
      href: `${base}/troubleshooting`,
      title: "Troubleshooting",
      description: "Describe a problem and Claude will diagnose it — querying manuscripts, gates, and the event log to find the root cause.",
    },
  ]

  return (
    <div>
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
        Journal Admin
      </h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
        Configure and manage your journal — workflows, team, templates, and submission types.
      </p>

      {/* Queue at-a-glance */}
      <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">Queue</h2>
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

      {/* Configuration sections */}
      <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">Configuration</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="block rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-4 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
          >
            <p className="font-medium text-zinc-900 dark:text-zinc-100 text-sm mb-1">{s.title}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{s.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
