export default async function EditorInChiefPage({
  params,
}: {
  params: Promise<{ acronym: string }>
}) {
  const { acronym } = await params

  return (
    <div>
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
        Editor-in-Chief
      </h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
        Oversee editorial operations, resolve escalations, make final decisions, and manage the editorial board for{" "}
        <span className="font-medium text-zinc-700 dark:text-zinc-300">{acronym}</span>.
      </p>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-8 text-center">
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          Editor-in-Chief dashboard — coming soon.
        </p>
      </div>
    </div>
  )
}
