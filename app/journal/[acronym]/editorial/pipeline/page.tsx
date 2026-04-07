import Link from "next/link"
import { notFound } from "next/navigation"
import { sql, cypher } from "@/lib/graph"
import { requireRole } from "@/lib/auth-helpers"
import { formatTrackingNumber } from "@/lib/tracking"

// ─── Types ───────────────────────────────────────────────────────────────────

interface Stage {
  /** Status enum value (or graph step name) used as the URL filter token. */
  key: string
  /** Display label */
  label: string
  /** 1-based ordering in the workflow */
  position: number
  /** Terminal stages (accepted/rejected/withdrawn) — hidden by default */
  isTerminal: boolean
  /** True when sourced from the workflow graph; false when sourced from the enum fallback */
  fromGraph: boolean
}

interface StageWithCounts extends Stage {
  count: number
  stalledCount: number
}

interface ManuscriptRow {
  id: string
  title: string
  tracking_number: string | null
  revision_number: number
  status: string
  manuscript_type: string
  author_name: string
  submitted_at: string
  days_in_stage: number
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STALLED_THRESHOLD_DAYS = 14
const PAGE_SIZE = 50

const ENUM_STAGES: Stage[] = [
  { key: "submitted",          label: "In Checklist Queue", position: 1, isTerminal: false, fromGraph: false },
  { key: "under_review",       label: "Under Review",       position: 2, isTerminal: false, fromGraph: false },
  { key: "revision_requested", label: "Awaiting Revision",  position: 3, isTerminal: false, fromGraph: false },
  { key: "accepted",           label: "Accepted",           position: 4, isTerminal: true,  fromGraph: false },
  { key: "rejected",           label: "Rejected",           position: 5, isTerminal: true,  fromGraph: false },
  { key: "withdrawn",          label: "Withdrawn",          position: 6, isTerminal: true,  fromGraph: false },
]

const TERMINAL_STATUSES = new Set(["accepted", "rejected", "withdrawn"])

// ─── Stage source: graph-first, enum-fallback ────────────────────────────────

/**
 * Read pipeline stages from the workflow graph for this journal.
 *
 * Returns Step nodes (Gates are conditional logic, not stages a manuscript
 * sits in) ordered by position. Each Step *should* carry a `status` property
 * mapping it to a status enum value; without that, the count source can't be
 * matched and we treat the graph as empty.
 *
 * Returns an empty array if no usable workflow exists yet — the caller will
 * fall back to the enum stage list.
 */
async function getGraphStages(journalId: string): Promise<Stage[]> {
  try {
    // AGE quirk: variable-length path with end-node label filtering can be
    // unreliable, so we MATCH all reachable nodes and filter by label in JS.
    // Same pattern as app/journal/[acronym]/admin/workflows/page.tsx.
    const rows = await cypher(
      `MATCH (w:WorkflowDefinition)-[:FIRST_STEP]->(first)
       WHERE w.journal_id = '${journalId}'
       MATCH (first)-[:NEXT*0..30]->(node)
       RETURN node.name AS name,
              node.position AS position,
              node.status AS status,
              node.terminal AS terminal,
              labels(node) AS labels`,
      ["name", "position", "status", "terminal", "labels"]
    )

    if (rows.length === 0) return []

    // De-dupe by status (multiple steps may share a status — first wins).
    // Skip nodes that aren't Steps or that have no status property to map onto.
    const seen = new Set<string>()
    const stages: Stage[] = []
    for (const r of rows) {
      const labels = String(r.labels ?? "")
      if (!labels.includes("Step")) continue
      if (r.status == null) continue
      const status = String(r.status)
      if (seen.has(status)) continue
      seen.add(status)
      stages.push({
        key: status,
        label: String(r.name),
        position: Number(r.position) || 0,
        isTerminal: r.terminal === true || r.terminal === "true",
        fromGraph: true,
      })
    }
    stages.sort((a, b) => a.position - b.position)
    return stages
  } catch {
    return []
  }
}

async function getPipelineStages(journalId: string): Promise<{ stages: Stage[]; source: "graph" | "enum" }> {
  const graphStages = await getGraphStages(journalId)
  if (graphStages.length > 0) return { stages: graphStages, source: "graph" }
  return { stages: ENUM_STAGES, source: "enum" }
}

// ─── Counts ──────────────────────────────────────────────────────────────────

async function getStageCounts(
  journalId: string,
  stages: Stage[]
): Promise<StageWithCounts[]> {
  const rows = await sql<{ status: string; count: string; stalled: string }>(`
    SELECT
      status::text AS status,
      COUNT(*)::text AS count,
      COUNT(*) FILTER (
        WHERE updated_at < now() - INTERVAL '${STALLED_THRESHOLD_DAYS} days'
      )::text AS stalled
    FROM manuscript.manuscripts
    WHERE journal_id = $1
    GROUP BY status
  `, [journalId])

  const map: Record<string, { count: number; stalled: number }> = {}
  for (const r of rows) {
    map[r.status] = { count: parseInt(r.count), stalled: parseInt(r.stalled) }
  }

  return stages.map((s) => ({
    ...s,
    count:        map[s.key]?.count   ?? 0,
    stalledCount: map[s.key]?.stalled ?? 0,
  }))
}

// ─── Manuscript table query ──────────────────────────────────────────────────

async function getManuscripts(
  journalId: string,
  filters: { stage: string | null; q: string | null; includeTerminal: boolean }
): Promise<ManuscriptRow[]> {
  return sql<ManuscriptRow>(`
    SELECT
      m.id,
      m.title,
      m.tracking_number,
      m.revision_number,
      m.status::text AS status,
      m.manuscript_type,
      p.full_name AS author_name,
      m.submitted_at::text AS submitted_at,
      GREATEST(0, EXTRACT(DAY FROM (now() - m.updated_at))::int) AS days_in_stage
    FROM manuscript.manuscripts m
    JOIN manuscript.people p ON p.id = m.submitted_by
    WHERE m.journal_id = $1
      AND ($2::text IS NULL OR m.status::text = $2)
      AND ($3::text IS NULL OR (
        m.title ILIKE '%' || $3 || '%'
        OR m.tracking_number ILIKE '%' || $3 || '%'
      ))
      AND ($4::boolean = true OR m.status::text NOT IN ('accepted','rejected','withdrawn'))
    ORDER BY m.updated_at ASC
    LIMIT ${PAGE_SIZE}
  `, [journalId, filters.stage, filters.q, filters.includeTerminal])
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildHref(
  acronym: string,
  current: { stage: string | null; q: string | null; includeTerminal: boolean },
  patch: Partial<{ stage: string | null; q: string | null; includeTerminal: boolean }>
): string {
  const next = { ...current, ...patch }
  const params = new URLSearchParams()
  if (next.stage) params.set("stage", next.stage)
  if (next.q) params.set("q", next.q)
  if (next.includeTerminal) params.set("include_terminal", "1")
  const qs = params.toString()
  return `/journal/${acronym}/editorial/pipeline${qs ? `?${qs}` : ""}`
}

function statusLabelOf(stages: Stage[], key: string): string {
  return stages.find((s) => s.key === key)?.label ?? key.replace(/_/g, " ")
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function PipelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ acronym: string }>
  searchParams: Promise<{ stage?: string; q?: string; include_terminal?: string }>
}) {
  const { acronym } = await params
  const sp = await searchParams

  const journalRows = await sql<{ id: string; name: string }>(
    "SELECT id, name FROM manuscript.journals WHERE UPPER(acronym) = UPPER($1)",
    [acronym]
  )
  const journal = journalRows[0]
  if (!journal) notFound()

  // Pipeline view is for editorial oversight roles
  await requireRole(
    journal.id,
    ["editor", "editor_in_chief", "editorial_support", "journal_admin"],
    `/journal/${acronym}/editorial/pipeline`
  )

  const { stages: rawStages, source } = await getPipelineStages(journal.id)

  const filters = {
    stage:           sp.stage ?? null,
    q:               sp.q?.trim() || null,
    includeTerminal: sp.include_terminal === "1",
  }

  const [stagesWithCounts, manuscripts] = await Promise.all([
    getStageCounts(journal.id, rawStages),
    getManuscripts(journal.id, filters),
  ])

  // Hide terminal stages from the strip unless toggled on
  const visibleStages = filters.includeTerminal
    ? stagesWithCounts
    : stagesWithCounts.filter((s) => !s.isTerminal)

  const totalActive = stagesWithCounts
    .filter((s) => !s.isTerminal)
    .reduce((sum, s) => sum + s.count, 0)
  const totalStalled = stagesWithCounts
    .filter((s) => !s.isTerminal)
    .reduce((sum, s) => sum + s.stalledCount, 0)

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-foreground mb-1">Manuscript Pipeline</h1>
        <p className="text-sm text-muted-foreground">
          {totalActive} active manuscript{totalActive !== 1 ? "s" : ""}
          {totalStalled > 0 && (
            <>
              {" · "}
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                {totalStalled} stalled (&gt;{STALLED_THRESHOLD_DAYS}d no activity)
              </span>
            </>
          )}
        </p>
      </header>

      {source === "enum" && (
        <div className="mb-5 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-2.5">
          <p className="text-xs text-muted-foreground">
            Showing default statuses — no workflow definition is configured for this journal yet.{" "}
            <Link
              href={`/journal/${acronym}/admin/workflow`}
              className="underline underline-offset-2 hover:text-foreground"
            >
              Configure a workflow
            </Link>{" "}
            to drive this view from the graph.
          </p>
        </div>
      )}

      {/* ─── Pipeline strip ─────────────────────────────────────────────── */}
      <nav
        aria-label="Workflow stages"
        className="mb-6 overflow-x-auto"
      >
        <ol className="flex items-stretch gap-2 min-w-min pb-2">
          {visibleStages.map((stage, i) => {
            const isActive = filters.stage === stage.key
            const hasStalled = stage.stalledCount > 0
            return (
              <li key={stage.key} className="flex items-center">
                <Link
                  href={buildHref(acronym, filters, {
                    stage: isActive ? null : stage.key,
                  })}
                  aria-pressed={isActive}
                  aria-label={`${stage.label}: ${stage.count} manuscripts${hasStalled ? `, ${stage.stalledCount} stalled` : ""}`}
                  className={[
                    "block w-40 rounded-lg border px-3 py-3 transition-colors",
                    isActive
                      ? "border-foreground bg-foreground/5"
                      : "border-border bg-card hover:border-foreground/40",
                  ].join(" ")}
                >
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">
                    {stage.label}
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-0.5">{stage.count}</p>
                  {hasStalled ? (
                    <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mt-0.5">
                      ⚠ {stage.stalledCount} &gt;{STALLED_THRESHOLD_DAYS}d
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-0.5">on track</p>
                  )}
                </Link>
                {i < visibleStages.length - 1 && (
                  <span aria-hidden="true" className="px-1 text-border select-none">→</span>
                )}
              </li>
            )
          })}
        </ol>
      </nav>

      {/* ─── Filter bar ─────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <form action={`/journal/${acronym}/editorial/pipeline`} method="GET" className="flex-1 min-w-[240px]">
          {filters.stage && <input type="hidden" name="stage" value={filters.stage} />}
          {filters.includeTerminal && <input type="hidden" name="include_terminal" value="1" />}
          <label htmlFor="pipeline-search" className="sr-only">
            Search manuscripts
          </label>
          <input
            id="pipeline-search"
            type="search"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Search by title or tracking number…"
            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
          />
        </form>

        {filters.stage && (
          <Link
            href={buildHref(acronym, filters, { stage: null })}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Clear stage filter
          </Link>
        )}

        <Link
          href={buildHref(acronym, filters, { includeTerminal: !filters.includeTerminal })}
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
        >
          {filters.includeTerminal ? "Hide terminal" : "Show terminal"}
        </Link>
      </div>

      {/* ─── Manuscript table ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border/50 flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">
            {filters.stage
              ? `${statusLabelOf(rawStages, filters.stage)} manuscripts`
              : "All manuscripts"}
          </h2>
          <span className="text-xs text-muted-foreground">
            {manuscripts.length} shown · ordered by oldest activity
          </span>
        </div>

        {manuscripts.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-muted-foreground">No manuscripts match the current filters.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">
              Manuscripts in the editorial pipeline, ordered by oldest activity first.
            </caption>
            <thead className="border-b border-border/50 text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="text-left font-medium px-5 py-2.5">Tracking #</th>
                <th scope="col" className="text-left font-medium px-3 py-2.5">Title</th>
                <th scope="col" className="text-left font-medium px-3 py-2.5">Author</th>
                <th scope="col" className="text-left font-medium px-3 py-2.5">Stage</th>
                <th scope="col" className="text-right font-medium px-5 py-2.5">In stage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {manuscripts.map((m) => {
                const stalled = m.days_in_stage > STALLED_THRESHOLD_DAYS
                const terminal = TERMINAL_STATUSES.has(m.status)
                return (
                  <tr key={m.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-5 py-2.5 align-top whitespace-nowrap">
                      <Link
                        href={`/journal/${acronym}/editorial/manuscripts/${m.id}`}
                        className="font-mono text-xs text-foreground/80 hover:text-foreground underline-offset-2 hover:underline"
                      >
                        {m.tracking_number
                          ? formatTrackingNumber(m.tracking_number, m.revision_number)
                          : "—"}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <Link
                        href={`/journal/${acronym}/editorial/manuscripts/${m.id}`}
                        className="text-foreground hover:underline underline-offset-2 line-clamp-2"
                      >
                        {m.title}
                      </Link>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {m.manuscript_type.replace(/_/g, " ")}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 align-top text-muted-foreground">{m.author_name}</td>
                    <td className="px-3 py-2.5 align-top">
                      <span className="inline-flex items-center text-xs px-2 py-0.5 rounded bg-muted text-foreground">
                        {statusLabelOf(rawStages, m.status)}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 align-top text-right whitespace-nowrap">
                      {terminal ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <span
                          className={
                            stalled
                              ? "text-xs font-medium text-amber-600 dark:text-amber-400"
                              : "text-xs text-muted-foreground"
                          }
                        >
                          {stalled && <span aria-hidden="true">⚠ </span>}
                          {m.days_in_stage}d
                          {stalled && <span className="sr-only"> (stalled)</span>}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
