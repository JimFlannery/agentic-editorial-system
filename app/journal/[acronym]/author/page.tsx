export default async function AuthorPage({
  params,
}: {
  params: Promise<{ acronym: string }>
}) {
  const { acronym } = await params

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-3">
          {acronym} · Author Center
        </p>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
          Author Center
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
          Submit manuscripts, track submission status, respond to revision requests,
          and manage your author profile for {acronym}.
        </p>
        <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 px-6 py-8">
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            Author portal — coming soon.
          </p>
        </div>
      </div>
    </div>
  )
}
