import Link from "next/link"
import { sql } from "@/lib/graph"

interface QueueRow {
  id: string
  title: string
  subject_area: string
  manuscript_type: string
  status: string
  submitted_at: string
  author_name: string
  author_email: string
  journal_name: string
  journal_id: string
  checklist_evaluated_at: string | null
  checklist_overall: string | null
}

async function getQueue(journalId: string): Promise<QueueRow[]> {
  return sql<QueueRow>(`
    SELECT
      m.id,
      m.title,
      m.subject_area,
      m.manuscript_type,
      m.status,
      m.submitted_at,
      p.full_name  AS author_name,
      p.email      AS author_email,
      j.name       AS journal_name,
      j.id         AS journal_id,
      chk.occurred_at::text AS checklist_evaluated_at,
      chk.payload->>'overall' AS checklist_overall
    FROM manuscript.manuscripts m
    JOIN manuscript.journals j  ON j.id = m.journal_id
    JOIN manuscript.people  p  ON p.id = m.submitted_by
    LEFT JOIN LATERAL (
      SELECT payload, occurred_at
      FROM history.events
      WHERE manuscript_id = m.id
        AND event_type = 'checklist.evaluated'
      ORDER BY occurred_at DESC
      LIMIT 1
    ) chk ON true
    WHERE m.status = 'submitted' AND m.journal_id = $1
    ORDER BY m.submitted_at ASC
  `, [journalId])
}

const statusColors: Record<string, string> = {
  pass: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  fail: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  needs_human_review: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  })
}

export default async function QueuePage({
  params,
}: {
  params: Promise<{ acronym: string }>
}) {
  const { acronym } = await params

  const journalRows = await sql<{ id: string }>(
    "SELECT id FROM manuscript.journals WHERE UPPER(acronym) = UPPER($1)",
    [acronym]
  )
  const journal = journalRows[0]
  const queue = await getQueue(journal.id)

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
            Checklist Queue
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {queue.length === 0
              ? "No manuscripts awaiting checklist."
              : `${queue.length} manuscript${queue.length !== 1 ? "s" : ""} awaiting admin checklist.`}
          </p>
        </div>
      </div>

      {queue.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 px-8 py-12 text-center">
          <p className="text-sm text-zinc-400">All caught up — no submissions in the queue.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map((ms) => (
            <Link
              key={ms.id}
              href={`/journal-admin/${acronym}/manuscripts/${ms.id}`}
              className="block rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-4 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100 text-sm mb-1 truncate">
                    {ms.title}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                    {ms.journal_name} · {ms.subject_area} · {ms.manuscript_type.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {ms.author_name} &lt;{ms.author_email}&gt; · Submitted {formatDate(ms.submitted_at)}
                  </p>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-2">
                  {ms.checklist_overall ? (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusColors[ms.checklist_overall] ?? "bg-zinc-100 text-zinc-700"}`}>
                      {ms.checklist_overall === "needs_human_review" ? "Needs review" : ms.checklist_overall}
                    </span>
                  ) : (
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      Not evaluated
                    </span>
                  )}
                  <span className="text-xs text-zinc-400">Open →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
