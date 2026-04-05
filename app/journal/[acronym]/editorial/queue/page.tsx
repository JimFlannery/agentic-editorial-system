import Link from "next/link"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/graph"
import { Pagination } from "@/components/pagination"

const PAGE_SIZE = 20

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

const EDITORIAL_ROLES = [
  "assistant_editor", "editor", "editor_in_chief", "editorial_support",
]

interface QueueResult {
  rows: QueueRow[]
  total: number
}

async function getQueue(
  journalId: string,
  personId: string,
  page: number,
): Promise<QueueResult> {
  // Find the union of subject_tags from all sections this person is assigned to
  // for their editorial roles. If any role has no section (section_id IS NULL),
  // they see all manuscripts.
  const [sectionRows, unrestrictedRows] = await Promise.all([
    sql<{ subject_tags: string[] }>(`
      SELECT js.subject_tags
      FROM manuscript.person_roles pr
      JOIN manuscript.journal_sections js ON js.id = pr.section_id
      WHERE pr.person_id = $1
        AND pr.journal_id = $2
        AND pr.role::text = ANY($3::text[])
        AND pr.section_id IS NOT NULL
    `, [personId, journalId, EDITORIAL_ROLES]),
    sql<{ count: string }>(`
      SELECT COUNT(*)::text AS count
      FROM manuscript.person_roles
      WHERE person_id = $1
        AND journal_id = $2
        AND role::text = ANY($3::text[])
        AND section_id IS NULL
    `, [personId, journalId, EDITORIAL_ROLES]),
  ])

  const unrestricted = parseInt(unrestrictedRows[0]?.count ?? "0") > 0
  const allTags = sectionRows.flatMap((r) => r.subject_tags)
  const offset = (page - 1) * PAGE_SIZE

  const whereClause = `
    WHERE m.status = 'submitted'
      AND m.journal_id = $1
      AND (
        $2::boolean = true
        OR (
          $3::text[] IS NOT NULL
          AND array_length($3::text[], 1) > 0
          AND EXISTS (
            SELECT 1 FROM unnest($3::text[]) AS tag
            WHERE m.subject_area ILIKE '%' || tag || '%'
          )
        )
      )
  `
  const baseParams: [string, boolean, string[] | null] = [
    journalId, unrestricted, allTags.length > 0 ? allTags : null,
  ]

  const [rows, countRows] = await Promise.all([
    sql<QueueRow>(`
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
      ${whereClause}
      ORDER BY m.submitted_at ASC
      LIMIT $4 OFFSET $5
    `, [...baseParams, PAGE_SIZE, offset]),
    sql<{ total: string }>(`
      SELECT COUNT(*)::text AS total
      FROM manuscript.manuscripts m
      ${whereClause}
    `, baseParams),
  ])

  return { rows, total: parseInt(countRows[0]?.total ?? "0") }
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
  searchParams,
}: {
  params: Promise<{ acronym: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { acronym } = await params
  const { page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? "1") || 1)

  const session = await auth.api.getSession({ headers: await headers() })

  const journalRows = await sql<{ id: string }>(
    "SELECT id FROM manuscript.journals WHERE UPPER(acronym) = UPPER($1)",
    [acronym]
  )
  const journal = journalRows[0]
  if (!journal) notFound()

  // Resolve person for section filtering; fall back to showing all if not found
  let personId: string | null = null
  if (session?.user.id) {
    const personRows = await sql<{ id: string }>(
      "SELECT id FROM manuscript.people WHERE auth_user_id = $1 AND journal_id = $2",
      [session.user.id, journal.id]
    )
    personId = personRows[0]?.id ?? null
  }

  const offset = (page - 1) * PAGE_SIZE

  // If person not resolved (e.g. system admin viewing), show all
  let queue: QueueRow[]
  let total: number

  if (personId) {
    const result = await getQueue(journal.id, personId, page)
    queue = result.rows
    total = result.total
  } else {
    const [rows, countRows] = await Promise.all([
      sql<QueueRow>(`
        SELECT
          m.id, m.title, m.subject_area, m.manuscript_type, m.status, m.submitted_at,
          p.full_name AS author_name, p.email AS author_email,
          j.name AS journal_name, j.id AS journal_id,
          chk.occurred_at::text AS checklist_evaluated_at,
          chk.payload->>'overall' AS checklist_overall
        FROM manuscript.manuscripts m
        JOIN manuscript.journals j ON j.id = m.journal_id
        JOIN manuscript.people p ON p.id = m.submitted_by
        LEFT JOIN LATERAL (
          SELECT payload, occurred_at FROM history.events
          WHERE manuscript_id = m.id AND event_type = 'checklist.evaluated'
          ORDER BY occurred_at DESC LIMIT 1
        ) chk ON true
        WHERE m.status = 'submitted' AND m.journal_id = $1
        ORDER BY m.submitted_at ASC
        LIMIT $2 OFFSET $3
      `, [journal.id, PAGE_SIZE, offset]),
      sql<{ total: string }>(`
        SELECT COUNT(*)::text AS total FROM manuscript.manuscripts
        WHERE status = 'submitted' AND journal_id = $1
      `, [journal.id]),
    ])
    queue = rows
    total = parseInt(countRows[0]?.total ?? "0")
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground mb-1">
            Checklist Queue
          </h1>
          <p className="text-sm text-muted-foreground">
            {total === 0
              ? "No manuscripts awaiting checklist."
              : `${total} manuscript${total !== 1 ? "s" : ""} awaiting admin checklist.`}
          </p>
        </div>
      </div>

      {total === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-8 py-12 text-center">
          <p className="text-sm text-muted-foreground">All caught up — no submissions in the queue.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map((ms) => (
            <Link
              key={ms.id}
              href={`/journal/${acronym}/editorial/manuscripts/${ms.id}`}
              className="block rounded-xl border border-border bg-card px-5 py-4 hover:border-border transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground text-sm mb-1 truncate">
                    {ms.title}
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    {ms.journal_name} · {ms.subject_area} · {ms.manuscript_type.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ms.author_name} &lt;{ms.author_email}&gt; · Submitted {formatDate(ms.submitted_at)}
                  </p>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-2">
                  {ms.checklist_overall ? (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusColors[ms.checklist_overall] ?? "bg-muted text-foreground"}`}>
                      {ms.checklist_overall === "needs_human_review" ? "Needs review" : ms.checklist_overall}
                    </span>
                  ) : (
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      Not evaluated
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">Open →</span>
                </div>
              </div>
            </Link>
          ))}
          {totalPages > 1 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <Pagination
                page={page}
                totalPages={totalPages}
                buildHref={(p) => `/journal/${acronym}/editorial/queue?page=${p}`}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
