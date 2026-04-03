import { notFound } from "next/navigation"
import Link from "next/link"
import { sql } from "@/lib/graph"
import ChecklistPanel from "./checklist"

interface ManuscriptRow {
  id: string
  title: string
  abstract: string | null
  subject_area: string | null
  manuscript_type: string
  status: string
  submitted_at: string
  journal_id: string
  journal_name: string
  author_name: string
  author_email: string
  author_orcid: string | null
}

interface ChecklistEvent {
  items: Array<{
    key: string
    status: "pass" | "fail" | "na" | "needs_review"
    confidence: number
    note: string
  }>
  overall: "pass" | "fail" | "needs_human_review"
  summary: string
}

async function getManuscript(id: string): Promise<ManuscriptRow | null> {
  const rows = await sql<ManuscriptRow>(`
    SELECT
      m.id,
      m.title,
      m.abstract,
      m.subject_area,
      m.manuscript_type,
      m.status,
      m.submitted_at::text AS submitted_at,
      j.id         AS journal_id,
      j.name       AS journal_name,
      p.full_name  AS author_name,
      p.email      AS author_email,
      p.orcid      AS author_orcid
    FROM manuscript.manuscripts m
    JOIN manuscript.journals j ON j.id = m.journal_id
    JOIN manuscript.people   p ON p.id = m.submitted_by
    WHERE m.id = $1
  `, [id])
  return rows[0] ?? null
}

async function getLatestChecklist(manuscriptId: string): Promise<ChecklistEvent | null> {
  const rows = await sql<{ payload: ChecklistEvent }>(`
    SELECT payload
    FROM history.events
    WHERE manuscript_id = $1
      AND event_type = 'checklist.evaluated'
    ORDER BY occurred_at DESC
    LIMIT 1
  `, [manuscriptId])
  return rows[0]?.payload ?? null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  })
}

export default async function ManuscriptDetailPage({
  params,
}: {
  params: Promise<{ acronym: string; id: string }>
}) {
  const { acronym, id } = await params
  const [manuscript, checklist] = await Promise.all([
    getManuscript(id),
    getLatestChecklist(id),
  ])

  if (!manuscript) notFound()

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-zinc-400 mb-6">
        <Link href={`/journal/${acronym}/editorial/assistant-editor`} className="hover:text-zinc-600 dark:hover:text-zinc-300">Editorial</Link>
        <span>/</span>
        <Link href={`/journal/${acronym}/editorial/queue`} className="hover:text-zinc-600 dark:hover:text-zinc-300">Checklist Queue</Link>
        <span>/</span>
        <span className="text-zinc-600 dark:text-zinc-400 truncate max-w-xs">{manuscript.title}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left: manuscript info (2/5) */}
        <div className="lg:col-span-2 space-y-5">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2 leading-snug">
              {manuscript.title}
            </h1>
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                {manuscript.manuscript_type.replace(/_/g, " ")}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                {manuscript.subject_area ?? "No subject area"}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                {manuscript.status.replace(/_/g, " ")}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-4 space-y-3 text-sm">
            <div>
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-0.5">Journal</p>
              <p className="text-zinc-700 dark:text-zinc-300">{manuscript.journal_name}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-0.5">Corresponding Author</p>
              <p className="text-zinc-700 dark:text-zinc-300">{manuscript.author_name}</p>
              <p className="text-zinc-400 text-xs">{manuscript.author_email}</p>
              {manuscript.author_orcid && (
                <p className="text-zinc-400 text-xs">ORCID: {manuscript.author_orcid}</p>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-0.5">Submitted</p>
              <p className="text-zinc-700 dark:text-zinc-300">{formatDate(manuscript.submitted_at)}</p>
            </div>
          </div>

          {manuscript.abstract && (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-4">
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Abstract</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {manuscript.abstract}
              </p>
            </div>
          )}
        </div>

        {/* Right: checklist (3/5) */}
        <div className="lg:col-span-3">
          <ChecklistPanel
            manuscriptId={manuscript.id}
            journalId={manuscript.journal_id}
            acronym={acronym}
            initialChecklist={checklist}
          />
        </div>
      </div>
    </div>
  )
}
