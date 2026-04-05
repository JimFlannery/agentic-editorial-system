import Link from "next/link"

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
          Access denied
        </p>
        <h1 className="text-2xl font-semibold text-foreground mb-3">
          You don't have permission to view this page
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          This area requires a role you haven't been assigned. If you believe this
          is an error, contact your editorial office.
        </p>
        <Link
          href="/"
          className="inline-flex items-center rounded-lg bg-foreground text-background text-sm font-medium px-4 py-2 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
        >
          Back to home
        </Link>
      </div>
    </div>
  )
}
