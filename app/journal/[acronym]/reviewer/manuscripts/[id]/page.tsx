import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/graph"
import ReviewForm from "./review-form"

interface ManuscriptRow {
  id: string
  title: string
  abstract: string | null
  manuscript_type: string
  submitted_at: string
  journal_id: string
  journal_name: string
  author_name: string
}

interface AssignmentRow {
  person_id: string
  invitation_status: string
  due_at: string | null
  assigned_at: string
}

interface PriorReview {
  summary: string
  recommendation: string
  occurred_at: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  })
}

function daysUntil(iso: string | null) {
  if (!iso) return null
  const diff = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000)
  if (diff < 0) return { text: "Overdue", overdue: true }
  if (diff === 0) return { text: "Due today", overdue: true }
  return { text: `Due in ${diff} days`, overdue: false }
}

export default async function ReviewerManuscriptPage({
  params,
}: {
  params: Promise<{ acronym: string; id: string }>
}) {
  const { acronym, id } = await params

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect(`/login?next=/journal/${acronym}/reviewer/manuscripts/${id}`)

  // Journal lookup
  const journalRows = await sql<{ id: string; name: string }>(
    "SELECT id, name FROM manuscript.journals WHERE UPPER(acronym) = UPPER($1)",
    [acronym]
  )
  const journal = journalRows[0]
  if (!journal) notFound()

  // Person lookup
  const personRows = await sql<{ id: string }>(
    "SELECT id FROM manuscript.people WHERE auth_user_id = $1 AND journal_id = $2",
    [session.user.id, journal.id]
  )
  const person = personRows[0]
  if (!person) notFound()

  // Fetch manuscript + assignment in parallel
  const [manuscriptRows, assignmentRows, priorReviewRows] = await Promise.all([
    sql<ManuscriptRow>(`
      SELECT
        m.id,
        m.title,
        m.abstract,
        m.manuscript_type,
        m.submitted_at::text,
        j.id   AS journal_id,
        j.name AS journal_name,
        p.full_name AS author_name
      FROM manuscript.manuscripts m
      JOIN manuscript.journals j ON j.id = m.journal_id
      JOIN manuscript.people   p ON p.id = m.submitted_by
      WHERE m.id = $1 AND m.journal_id = $2
    `, [id, journal.id]),
    sql<AssignmentRow>(`
      SELECT person_id, invitation_status, due_at::text, assigned_at::text
      FROM manuscript.assignments
      WHERE manuscript_id = $1 AND person_id = $2 AND role = 'reviewer'
    `, [id, person.id]),
    sql<PriorReview>(`
      SELECT
        payload->>'summary' AS summary,
        payload->>'recommendation' AS recommendation,
        occurred_at::text
      FROM history.events
      WHERE manuscript_id = $1
        AND actor_id = $2
        AND event_type = 'review.submitted'
      ORDER BY occurred_at DESC
      LIMIT 1
    `, [id, person.id]),
  ])

  const manuscript = manuscriptRows[0]
  if (!manuscript) notFound()

  const assignment = assignmentRows[0]
  if (!assignment) notFound() // not invited to this manuscript

  const priorReview = priorReviewRows[0] ?? null

  const due = daysUntil(assignment.due_at)

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-zinc-400 mb-6">
        <Link href={`/journal/${acronym}/reviewer`} className="hover:text-zinc-600 dark:hover:text-zinc-300">
          Reviewer Center
        </Link>
        <span>/</span>
        <span className="text-zinc-600 dark:text-zinc-400 truncate max-w-xs">{manuscript.title}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left: manuscript info */}
        <div className="lg:col-span-2 space-y-5">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2 leading-snug">
              {manuscript.title}
            </h1>
            <div className="flex flex-wrap gap-2">
              <span className="text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                {manuscript.manuscript_type.replace(/_/g, " ")}
              </span>
              {due && (
                <span className={`text-xs px-2 py-0.5 rounded border ${
                  due.overdue
                    ? "bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800"
                    : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800"
                }`}>
                  {due.text}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-4 space-y-3 text-sm">
            <div>
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-0.5">Journal</p>
              <p className="text-zinc-700 dark:text-zinc-300">{manuscript.journal_name}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-0.5">Author</p>
              <p className="text-zinc-700 dark:text-zinc-300">{manuscript.author_name}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-0.5">Submitted</p>
              <p className="text-zinc-700 dark:text-zinc-300">{formatDate(manuscript.submitted_at)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-0.5">Invited</p>
              <p className="text-zinc-700 dark:text-zinc-300">{formatDate(assignment.assigned_at)}</p>
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

        {/* Right: review form */}
        <div className="lg:col-span-3">
          <ReviewForm
            acronym={acronym}
            manuscriptId={id}
            journalId={manuscript.journal_id}
            invitationStatus={assignment.invitation_status}
            priorReview={priorReview}
          />
        </div>
      </div>
    </div>
  )
}
