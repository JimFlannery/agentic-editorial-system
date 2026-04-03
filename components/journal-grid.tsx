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
      <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 px-8 py-16 text-center">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">No journals configured</p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-4">
          Add your first journal to get started.
        </p>
        <Link
          href="/admin/journals"
          className="inline-flex text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
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
          className="group block rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-5 hover:border-zinc-400 dark:hover:border-zinc-600 hover:shadow-sm transition-all"
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-xs font-mono font-medium text-zinc-600 dark:text-zinc-400">
              {j.acronym}
            </span>
            <span className="text-xs text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-400 dark:group-hover:text-zinc-500 transition-colors">
              →
            </span>
          </div>
          <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm leading-snug mb-2">
            {j.name}
          </p>
          <div className="space-y-0.5">
            {j.subject_area && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{j.subject_area}</p>
            )}
            {j.issn && (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 font-mono">ISSN {j.issn}</p>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}
