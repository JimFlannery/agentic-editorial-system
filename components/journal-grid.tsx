import Link from "next/link"

interface Journal {
  id: string
  name: string
  acronym: string
  issn: string | null
  subject_area: string | null
}

export function JournalGrid({ journals }: { journals: Journal[] }) {
  if (journals.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-8 py-16 text-center">
        <p className="text-sm font-medium text-muted-foreground mb-1">No journals configured</p>
        <p className="text-xs text-muted-foreground mb-4">
          Add your first journal to get started.
        </p>
        <Link
          href="/admin/journals"
          className="inline-flex text-xs font-medium text-foreground bg-muted hover:bg-muted px-3 py-1.5 rounded-lg transition-colors"
        >
          Add journal in System Admin →
        </Link>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {journals.map((j) => (
        <Link
          key={j.id}
          href={`/journal/${j.acronym}`}
          className="group block rounded-xl border border-border bg-card px-6 py-5 hover:border-border hover:shadow-sm transition-all"
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-xs font-mono font-medium text-muted-foreground">
              {j.acronym}
            </span>
            <span className="text-xs text-border group-hover:text-muted-foreground transition-colors">
              →
            </span>
          </div>
          <p className="font-semibold text-foreground text-sm leading-snug mb-2">
            {j.name}
          </p>
          <div className="space-y-0.5">
            {j.subject_area && (
              <p className="text-xs text-muted-foreground">{j.subject_area}</p>
            )}
            {j.issn && (
              <p className="text-xs text-muted-foreground font-mono">ISSN {j.issn}</p>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}
