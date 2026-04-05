import Link from "next/link"

interface PaginationProps {
  page: number
  totalPages: number
  buildHref: (page: number) => string
}

export function Pagination({ page, totalPages, buildHref }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-100 dark:border-zinc-800">
      <span className="text-xs text-zinc-400">
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={buildHref(page - 1)}
            className="text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            ← Previous
          </Link>
        ) : (
          <span className="text-xs font-medium text-zinc-300 dark:text-zinc-600 px-3 py-1.5 rounded-lg border border-zinc-100 dark:border-zinc-800 cursor-not-allowed">
            ← Previous
          </span>
        )}
        {page < totalPages ? (
          <Link
            href={buildHref(page + 1)}
            className="text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Next →
          </Link>
        ) : (
          <span className="text-xs font-medium text-zinc-300 dark:text-zinc-600 px-3 py-1.5 rounded-lg border border-zinc-100 dark:border-zinc-800 cursor-not-allowed">
            Next →
          </span>
        )}
      </div>
    </div>
  )
}
