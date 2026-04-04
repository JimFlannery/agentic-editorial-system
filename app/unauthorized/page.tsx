import Link from "next/link"

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-3">
          Access denied
        </p>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
          You don't have permission to view this page
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
          This area requires a role you haven't been assigned. If you believe this
          is an error, contact your editorial office.
        </p>
        <Link
          href="/"
          className="inline-flex items-center rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium px-4 py-2 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
        >
          Back to home
        </Link>
      </div>
    </div>
  )
}
