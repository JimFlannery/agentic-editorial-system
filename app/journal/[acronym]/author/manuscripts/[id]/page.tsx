import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/graph"
import ReviseForm from "./revise-form"

interface ManuscriptRow {
  id: string
  title: string
  abstract: string | null
  manuscript_type: string
  status: string
  submitted_at: string
  journal_id: string
  file_key: string | null
  file_name: string | null
}

interface ManuscriptAuthor {
  person_id: string
  full_name: string
  email: string
  orcid: string | null
  is_corresponding: boolean
}

interface DecisionEvent {
  decision: string
  letter: string
  occurred_at: string
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  submitted:          { label: "In Review Queue",    cls: "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800" },
  under_review:       { label: "Under Review",       cls: "bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800" },
  revision_requested: { label: "Revision Requested", cls: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800" },
  accepted:           { label: "Accepted",           cls: "bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800" },
  rejected:           { label: "Rejected",           cls: "bg-red-50 text-red-600 border border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800" },
  withdrawn:          { label: "Withdrawn",          cls: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" },
}

const DECISION_LABEL: Record<string, string> = {
  accept:          "Accept",
  minor_revision:  "Minor Revision",
  major_revision:  "Major Revision",
  reject:          "Reject",
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  })
}

export default async function AuthorManuscriptPage({
  params,
}: {
  params: Promise<{ acronym: string; id: string }>
}) {
  const { acronym, id } = await params

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect(`/login?next=/journal/${acronym}/author/manuscripts/${id}`)

  const journalRows = await sql<{ id: string }>(
    "SELECT id FROM manuscript.journals WHERE UPPER(acronym) = UPPER($1)",
    [acronym]
  )
  const journal = journalRows[0]
  if (!journal) notFound()

  const personRows = await sql<{ id: string }>(
    "SELECT id FROM manuscript.people WHERE auth_user_id = $1 AND journal_id = $2",
    [session.user.id, journal.id]
  )
  const person = personRows[0]
  if (!person) notFound()

  const [manuscriptRows, decisionRows, authors] = await Promise.all([
    sql<ManuscriptRow>(`
      SELECT id, title, abstract, manuscript_type, status,
             submitted_at::text, journal_id, file_key, file_name
      FROM manuscript.manuscripts
      WHERE id = $1 AND submitted_by = $2
    `, [id, person.id]),
    sql<DecisionEvent>(`
      SELECT
        payload->>'decision'  AS decision,
        payload->>'letter'    AS letter,
        occurred_at::text     AS occurred_at
      FROM history.events
      WHERE manuscript_id = $1
        AND event_type = 'decision.sent'
      ORDER BY occurred_at DESC
      LIMIT 1
    `, [id]),
    sql<ManuscriptAuthor>(`
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
    `, [id]),
  ])

  const manuscript = manuscriptRows[0]
  if (!manuscript) notFound()

  const decision = decisionRows[0] ?? null
  const meta = STATUS_META[manuscript.status]

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-zinc-400 mb-6">
        <Link href={`/journal/${acronym}/author`} className="hover:text-zinc-600 dark:hover:text-zinc-300">
          My Submissions
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
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta?.cls ?? "bg-zinc-100 text-zinc-500"}`}>
                {meta?.label ?? manuscript.status}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-4 space-y-3 text-sm">
            <div>
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-0.5">Submitted</p>
              <p className="text-zinc-700 dark:text-zinc-300">{formatDate(manuscript.submitted_at)}</p>
            </div>
            {authors.length > 1 && (
              <div>
                <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
                  Authors ({authors.length})
                </p>
                <ul className="space-y-1.5">
                  {authors.map((a) => (
                    <li key={a.person_id} className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">{a.full_name}</span>
                      {a.is_corresponding && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                          Corresponding
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {manuscript.file_key && (
              <div>
                <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1">Your Manuscript</p>
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
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-4">
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Abstract</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {manuscript.abstract}
              </p>
            </div>
          )}
        </div>

        {/* Right: decision letter + revision form */}
        <div className="lg:col-span-3 space-y-6">
          {decision ? (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Decision Letter</h2>
                <span className="text-xs text-zinc-400">{formatDate(decision.occurred_at)}</span>
              </div>
              <div className="px-5 py-5 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Decision:</span>
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {DECISION_LABEL[decision.decision] ?? decision.decision}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Letter</p>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {decision.letter}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-10 text-center">
              <p className="text-sm text-zinc-400">
                {manuscript.status === "submitted"
                  ? "Your manuscript is in the editorial queue. We will notify you when a decision is reached."
                  : manuscript.status === "under_review"
                  ? "Your manuscript is currently under review."
                  : "No decision letter on file."}
              </p>
            </div>
          )}

          {manuscript.status === "revision_requested" && (
            <ReviseForm
              acronym={acronym}
              manuscriptId={manuscript.id}
              journalId={manuscript.journal_id}
            />
          )}
        </div>
      </div>
    </div>
  )
}
