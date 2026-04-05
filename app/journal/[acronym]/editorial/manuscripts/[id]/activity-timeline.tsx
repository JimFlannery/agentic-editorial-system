export interface TimelineEvent {
  event_type: string
  occurred_at: string
  actor_name: string | null
  actor_type: string | null
  payload: Record<string, unknown>
}

interface EventMeta {
  label: (e: TimelineEvent) => string
  dot: (e: TimelineEvent) => string
}

const DECISION_LABELS: Record<string, string> = {
  accept:         "Accepted",
  minor_revision: "Minor revision requested",
  major_revision: "Major revision requested",
  reject:         "Rejected",
}

const EVENT_META: Record<string, EventMeta> = {
  "manuscript.submitted": {
    label: (e) => `Submitted by ${e.actor_name ?? "author"}`,
    dot:   ()  => "bg-zinc-400",
  },
  "checklist.evaluated": {
    label: (e) => {
      const o = e.payload?.overall as string | undefined
      if (o === "pass") return "Checklist passed"
      if (o === "fail") return "Checklist failed"
      return "Checklist evaluated — needs human review"
    },
    dot: (e) => {
      const o = e.payload?.overall as string | undefined
      return o === "pass" ? "bg-green-500" : o === "fail" ? "bg-red-500" : "bg-amber-500"
    },
  },
  "reviewer.invited": {
    label: (e) => `Reviewer invited${e.payload?.reviewer_name ? `: ${e.payload.reviewer_name}` : ""}`,
    dot:   ()  => "bg-violet-400",
  },
  "reviewer.accepted": {
    label: (e) => `Reviewer accepted${e.payload?.reviewer_name ? `: ${e.payload.reviewer_name}` : ""}`,
    dot:   ()  => "bg-violet-500",
  },
  "reviewer.declined": {
    label: (e) => `Reviewer declined${e.payload?.reviewer_name ? `: ${e.payload.reviewer_name}` : ""}`,
    dot:   ()  => "bg-zinc-400",
  },
  "review.submitted": {
    label: (e) => `Review submitted${e.payload?.reviewer_name ? ` by ${e.payload.reviewer_name}` : ""}`,
    dot:   ()  => "bg-indigo-500",
  },
  "decision.sent": {
    label: (e) => {
      const d = e.payload?.decision as string | undefined
      return d ? `Decision: ${DECISION_LABELS[d] ?? d}` : "Decision sent"
    },
    dot: (e) => {
      const d = e.payload?.decision as string | undefined
      return d === "accept" ? "bg-green-500" : d === "reject" ? "bg-red-500" : "bg-amber-500"
    },
  },
  "revision.submitted": {
    label: () => "Revision submitted by author",
    dot:   ()  => "bg-amber-500",
  },
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  })
}

export function ActivityTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) return null

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden mt-8">
      <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Activity</h2>
      </div>
      <div className="px-5 py-5">
        <ol className="relative border-l border-zinc-200 dark:border-zinc-700 ml-2 space-y-5">
          {events.map((ev, i) => {
            const meta = EVENT_META[ev.event_type]
            const label = meta
              ? meta.label(ev)
              : ev.event_type.replace(/\./g, " ")
            const dot = meta ? meta.dot(ev) : "bg-zinc-400"
            return (
              <li key={i} className="ml-5">
                <span className={`absolute -left-[7px] flex h-3.5 w-3.5 rounded-full ring-2 ring-white dark:ring-zinc-900 ${dot}`} />
                <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-snug">{label}</p>
                <time className="text-xs text-zinc-400">{formatDateTime(ev.occurred_at)}</time>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
