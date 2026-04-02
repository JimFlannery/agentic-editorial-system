import { sql } from "@/lib/graph"

interface Journal {
  id: string
  name: string
  issn: string | null
  subject_area: string | null
  created_at: string
}

export default async function JournalsPage() {
  const journals = await sql<Journal>(
    "SELECT id, name, issn, subject_area, created_at FROM manuscript.journals ORDER BY name"
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Journals</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {journals.length} journal{journals.length !== 1 ? "s" : ""} on this instance
          </p>
        </div>
        <button className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium px-4 py-2 hover:opacity-90 transition-opacity">
          Add journal
        </button>
      </div>

      {journals.length === 0 ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">No journals yet.</p>
      ) : (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Name</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">ISSN</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Subject area</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Added</th>
              </tr>
            </thead>
            <tbody>
              {journals.map((j, i) => (
                <tr
                  key={j.id}
                  className={i < journals.length - 1 ? "border-b border-zinc-100 dark:border-zinc-800" : ""}
                >
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{j.name}</td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{j.issn ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{j.subject_area ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-400 dark:text-zinc-500 text-xs">
                    {new Date(j.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
