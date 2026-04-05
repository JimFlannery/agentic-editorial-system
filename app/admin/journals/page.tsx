import { sql } from "@/lib/graph"
import { AddJournalDialog } from "./add-journal-dialog"

interface Journal {
  id: string
  name: string
  acronym: string | null
  issn: string | null
  subject_area: string | null
  created_at: string
}

export default async function JournalsPage() {
  const journals = await sql<Journal>(
    "SELECT id, name, acronym, issn, subject_area, created_at FROM manuscript.journals ORDER BY name"
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Journals</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {journals.length} journal{journals.length !== 1 ? "s" : ""} on this instance
          </p>
        </div>
        <AddJournalDialog />
      </div>

      {journals.length === 0 ? (
        <p className="text-sm text-muted-foreground">No journals yet.</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Acronym</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">ISSN</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Subject area</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Added</th>
              <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {journals.map((j, i) => (
                <tr
                  key={j.id}
                  className={i < journals.length - 1 ? "border-b border-border/50" : ""}
                >
                  <td className="px-4 py-3 font-medium text-foreground">{j.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{j.acronym ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{j.issn ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{j.subject_area ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(j.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <AddJournalDialog journal={j} />
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
