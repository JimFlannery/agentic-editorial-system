import { notFound } from "next/navigation"
import Link from "next/link"
import { sql } from "@/lib/graph"
import { formatTrackingNumber } from "@/lib/tracking"
import ChecklistPanel from "./checklist"
import ReviewerPanel from "./reviewer-panel"
import DecisionPanel from "./decision-panel"
import { ActivityTimeline, type TimelineEvent } from "./activity-timeline"
import { getManuscriptReviewers, getSubmittedReviews } from "./actions"

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
  file_key: string | null
  file_name: string | null
  tracking_number: string | null
  revision_number: number
}

interface ManuscriptAuthor {
  person_id: string
  full_name: string
  email: string
  orcid: string | null
  is_corresponding: boolean
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
      m.file_key,
      m.file_name,
      m.tracking_number,
      m.revision_number,
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

async function getAuthors(manuscriptId: string): Promise<ManuscriptAuthor[]> {
  return sql<ManuscriptAuthor>(`
    SELECT
      p.id        AS person_id,
      p.full_name,
      p.email,
      p.orcid,
      ma.is_corresponding
    FROM manuscript.manuscript_authors ma
    JOIN manuscript.people p ON p.id = ma.person_id
    WHERE ma.manuscript_id = $1
    ORDER BY ma.display_order
  `, [manuscriptId])
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
  const [manuscript, checklist, reviewers, submittedReviews, authors, timelineEvents] = await Promise.all([
    getManuscript(id),
    getLatestChecklist(id),
    getManuscriptReviewers(id),
    getSubmittedReviews(id),
    getAuthors(id),
    sql<TimelineEvent>(`
      SELECT
        e.event_type,
        e.occurred_at::text AS occurred_at,
        p.full_name         AS actor_name,
        e.actor_type,
        e.payload
      FROM history.events e
      LEFT JOIN manuscript.people p ON p.id = e.actor_id
      WHERE e.manuscript_id = $1
      ORDER BY e.occurred_at ASC
    `, [id]),
  ])

  if (!manuscript) notFound()

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-muted-foreground mb-6">
        <Link href={`/journal/${acronym}/editorial/assistant-editor`} className="hover:text-foreground">Editorial</Link>
        <span>/</span>
        <Link href={`/journal/${acronym}/editorial/queue`} className="hover:text-foreground">Checklist Queue</Link>
        <span>/</span>
        <span className="text-muted-foreground truncate max-w-xs">{manuscript.title}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left: manuscript info (2/5) */}
        <div className="lg:col-span-2 space-y-5">
          <div>
            {manuscript.tracking_number && (
              <p className="text-xs font-mono text-muted-foreground mb-1">
                {formatTrackingNumber(manuscript.tracking_number, manuscript.revision_number)}
              </p>
            )}
            <h1 className="text-lg font-semibold text-foreground mb-2 leading-snug">
              {manuscript.title}
            </h1>
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                {manuscript.manuscript_type.replace(/_/g, " ")}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                {manuscript.subject_area ?? "No subject area"}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                {manuscript.status.replace(/_/g, " ")}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card px-4 py-4 space-y-3 text-sm">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Journal</p>
              <p className="text-foreground">{manuscript.journal_name}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                Authors <span className="normal-case font-normal">({authors.length || 1})</span>
              </p>
              {authors.length > 0 ? (
                <ul className="space-y-2">
                  {authors.map((a) => (
                    <li key={a.person_id}>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm text-foreground">{a.full_name}</span>
                        {a.is_corresponding && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                            Corresponding
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{a.email}</p>
                      {a.orcid && <p className="text-xs text-muted-foreground">ORCID: {a.orcid}</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                // Fallback for manuscripts without author list rows (pre-migration)
                <>
                  <p className="text-foreground">{manuscript.author_name}</p>
                  <p className="text-muted-foreground text-xs">{manuscript.author_email}</p>
                  {manuscript.author_orcid && (
                    <p className="text-muted-foreground text-xs">ORCID: {manuscript.author_orcid}</p>
                  )}
                </>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Submitted</p>
              <p className="text-foreground">{formatDate(manuscript.submitted_at)}</p>
            </div>
            {manuscript.file_key && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Manuscript File</p>
                <a
                  href={`/api/manuscript/${manuscript.id}/download`}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {manuscript.file_name ?? "Download"}
                </a>
              </div>
            )}
          </div>

          {manuscript.abstract && (
            <div className="rounded-xl border border-border bg-card px-4 py-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Abstract</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
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

      {/* Reviewer invitation — shown once manuscript moves to under_review */}
      {manuscript.status === "under_review" && (
        <ReviewerPanel
          acronym={acronym}
          manuscriptId={manuscript.id}
          journalId={manuscript.journal_id}
          initialReviewers={reviewers}
        />
      )}

      {/* Editor decision — shown when at least one review has been submitted */}
      {submittedReviews.length > 0 && manuscript.status === "under_review" && (
        <DecisionPanel
          acronym={acronym}
          manuscriptId={manuscript.id}
          journalId={manuscript.journal_id}
          reviews={submittedReviews}
        />
      )}

      <ActivityTimeline events={timelineEvents} />
    </div>
  )
}
