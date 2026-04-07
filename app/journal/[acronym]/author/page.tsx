import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/graph"
import { Pagination } from "@/components/pagination"
import { formatTrackingNumber } from "@/lib/tracking"

const PAGE_SIZE = 20

interface Manuscript {
  id: string
  title: string
  status: string
  manuscript_type: string
  submitted_at: string
  tracking_number: string | null
  revision_number: number
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  submitted:          { label: "In Review Queue",   cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  under_review:       { label: "Under Review",      cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" },
  revision_requested: { label: "Revision Requested", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  accepted:           { label: "Accepted",           cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  rejected:           { label: "Rejected",           cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  withdrawn:          { label: "Withdrawn",          cls: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  })
}

export default async function AuthorPage({
  params,
  searchParams,
}: {
  params: Promise<{ acronym: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { acronym } = await params
  const { page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? "1") || 1)
  const offset = (page - 1) * PAGE_SIZE

  // Auth check
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect(`/login?next=/journal/${acronym}/author`)

  // Journal lookup
  const journalRows = await sql<{ id: string; name: string }>(
    "SELECT id, name FROM manuscript.journals WHERE UPPER(acronym) = UPPER($1)",
    [acronym]
  )
  const journal = journalRows[0]
  if (!journal) notFound()

  // Person lookup — links auth user to editorial identity
  const personRows = await sql<{ id: string; full_name: string }>(
    "SELECT id, full_name FROM manuscript.people WHERE auth_user_id = $1 AND journal_id = $2",
    [session.user.id, journal.id]
  )
  const person = personRows[0]

  // No person record for this journal
  if (!person) {
    return (
      <div className="max-w-lg">
        <h1 className="text-xl font-semibold text-foreground mb-2">
          Account not provisioned
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your account ({session.user.email}) does not have an author profile for{" "}
          <span className="font-medium text-foreground">{acronym}</span>.
          Please contact the editorial office to have your account set up.
        </p>
      </div>
    )
  }

  // Fetch manuscripts (paginated) + total count in parallel
  const [manuscripts, countRows, statCountRows] = await Promise.all([
    sql<Manuscript>(`
      SELECT id, title, status, manuscript_type, submitted_at::text AS submitted_at,
             tracking_number, revision_number
      FROM manuscript.manuscripts
      WHERE submitted_by = $1
      ORDER BY submitted_at DESC
      LIMIT $2 OFFSET $3
    `, [person.id, PAGE_SIZE, offset]),
    sql<{ total: string }>(`
      SELECT COUNT(*)::text AS total FROM manuscript.manuscripts WHERE submitted_by = $1
    `, [person.id]),
    sql<{ status: string; count: string }>(`
      SELECT status, COUNT(*)::text AS count
      FROM manuscript.manuscripts
      WHERE submitted_by = $1
      GROUP BY status
    `, [person.id]),
  ])

  const total = parseInt(countRows[0]?.total ?? "0")
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const statMap: Record<string, number> = {}
  for (const r of statCountRows) statMap[r.status] = parseInt(r.count)

  const active    = (statMap["submitted"] ?? 0) + (statMap["under_review"] ?? 0)
  const revisions = statMap["revision_requested"] ?? 0
  const decisions = (statMap["accepted"] ?? 0) + (statMap["rejected"] ?? 0)

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-1">
        Author Center
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        Welcome back,{" "}
        <span className="font-medium text-foreground">{person.full_name}</span>.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: "Active Submissions", count: active },
          { label: "Awaiting Revision",  count: revisions },
          { label: "Decisions Received", count: decisions },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-card px-5 py-4"
          >
            <p className="text-2xl font-bold text-foreground mb-1">{stat.count}</p>
            <p className="text-sm font-medium text-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Manuscript list */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border/50 flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">My Submissions</h2>
          <span className="text-xs text-muted-foreground">{total} total</span>
        </div>

        {total === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              No submissions yet.
            </p>
            <Link
              href={`/journal/${acronym}/author/submit`}
              className="inline-flex items-center rounded-lg bg-primary text-primary-foreground text-sm font-medium px-4 py-2 hover:bg-primary/90 transition-colors"
            >
              Submit a manuscript
            </Link>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-border/50">
              {manuscripts.map((m) => {
                const meta = STATUS_META[m.status]
                return (
                  <li key={m.id}>
                    <Link
                      href={`/journal/${acronym}/author/manuscripts/${m.id}`}
                      className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {m.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {m.tracking_number && (
                            <span className="font-mono text-foreground/70 mr-2">
                              {formatTrackingNumber(m.tracking_number, m.revision_number)}
                            </span>
                          )}
                          {m.manuscript_type.replace(/_/g, " ")} · Submitted {formatDate(m.submitted_at)}
                        </p>
                      </div>
                      <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${meta?.cls ?? "bg-zinc-100 text-zinc-500"}`}>
                        {meta?.label ?? m.status}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
            <Pagination
              page={page}
              totalPages={totalPages}
              buildHref={(p) => `/journal/${acronym}/author?page=${p}`}
            />
          </>
        )}
      </div>
    </div>
  )
}
