import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/graph"

interface ReviewAssignment {
  manuscript_id: string
  title: string
  author_name: string
  invited_at: string
  due_at: string | null
  review_status: string   // 'invited' | 'accepted' | 'declined' | 'submitted'
}

const INVITE_META: Record<string, { label: string; cls: string }> = {
  invited:   { label: "Awaiting Response", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  accepted:  { label: "In Progress",       cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  submitted: { label: "Submitted",         cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  declined:  { label: "Declined",          cls: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  })
}

function daysUntil(iso: string | null): string | null {
  if (!iso) return null
  const diff = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000)
  if (diff < 0) return "Overdue"
  if (diff === 0) return "Due today"
  return `${diff}d remaining`
}

export default async function ReviewerPage({
  params,
}: {
  params: Promise<{ acronym: string }>
}) {
  const { acronym } = await params

  // Auth check
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect(`/login?next=/journal/${acronym}/reviewer`)

  // Journal lookup
  const journalRows = await sql<{ id: string; name: string }>(
    "SELECT id, name FROM manuscript.journals WHERE UPPER(acronym) = UPPER($1)",
    [acronym]
  )
  const journal = journalRows[0]
  if (!journal) notFound()

  // Person lookup
  const personRows = await sql<{ id: string; full_name: string }>(
    "SELECT id, full_name FROM manuscript.people WHERE auth_user_id = $1 AND journal_id = $2",
    [session.user.id, journal.id]
  )
  const person = personRows[0]

  if (!person) {
    return (
      <div className="max-w-lg">
        <h1 className="text-xl font-semibold text-foreground mb-2">
          Account not provisioned
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your account ({session.user.email}) does not have a reviewer profile for{" "}
          <span className="font-medium text-foreground">{acronym}</span>.
          Please contact the editorial office to have your account set up.
        </p>
      </div>
    )
  }

  const assignments = await sql<ReviewAssignment>(`
    SELECT
      m.id    AS manuscript_id,
      m.title,
      p.full_name AS author_name,
      a.assigned_at::text AS invited_at,
      a.due_at::text      AS due_at,
      a.invitation_status AS review_status
    FROM manuscript.assignments a
    JOIN manuscript.manuscripts m ON m.id = a.manuscript_id
    JOIN manuscript.people p ON p.id = m.submitted_by
    WHERE a.person_id = $1
      AND a.role = 'reviewer'
      AND a.released_at IS NULL
    ORDER BY a.assigned_at DESC
  `, [person.id])

  const pending   = assignments.filter((a) => a.review_status === "invited").length
  const active    = assignments.filter((a) => a.review_status === "accepted").length
  const completed = assignments.filter((a) => a.review_status === "submitted").length

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-1">
        Reviewer Center
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        Welcome back,{" "}
        <span className="font-medium text-foreground">{person.full_name}</span>.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: "Pending Invitations", count: pending },
          { label: "Reviews in Progress",  count: active },
          { label: "Reviews Completed",    count: completed },
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

      {/* Assignment list */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border/50 flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">My Reviews</h2>
          <span className="text-xs text-muted-foreground">{assignments.length} total</span>
        </div>

        {assignments.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No review assignments yet.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              You will receive an email when an editor invites you to review a manuscript.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/50">
            {assignments.map((a) => {
              const meta = INVITE_META[a.review_status]
              const due = daysUntil(a.due_at)
              return (
                <li key={a.manuscript_id}>
                  <Link
                    href={`/journal/${acronym}/reviewer/manuscripts/${a.manuscript_id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {a.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {a.author_name} · Invited {formatDate(a.invited_at)}
                        {due && (
                          <span className={`ml-2 ${due === "Overdue" ? "text-red-500" : "text-muted-foreground"}`}>
                            · {due}
                          </span>
                        )}
                      </p>
                    </div>
                    <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${meta?.cls ?? "bg-zinc-100 text-zinc-500"}`}>
                      {meta?.label ?? a.review_status}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
