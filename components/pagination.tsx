import Link from "next/link"

interface PaginationProps {
  page: number
  totalPages: number
  buildHref: (page: number) => string
}

export function Pagination({ page, totalPages, buildHref }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-border/50">
      <span className="text-xs text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={buildHref(page - 1)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-input hover:bg-muted/50 transition-colors"
          >
            ← Previous
          </Link>
        ) : (
          <span className="text-xs font-medium text-border px-3 py-1.5 rounded-lg border border-border/50 cursor-not-allowed">
            ← Previous
          </span>
        )}
        {page < totalPages ? (
          <Link
            href={buildHref(page + 1)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-input hover:bg-muted/50 transition-colors"
          >
            Next →
          </Link>
        ) : (
          <span className="text-xs font-medium text-border px-3 py-1.5 rounded-lg border border-border/50 cursor-not-allowed">
            Next →
          </span>
        )}
      </div>
    </div>
  )
}
