import { cypher } from "@/lib/graph"
import { AddEmailTemplateDialog } from "./add-email-template-dialog"

interface TemplateRow {
  id: string
  name: string
  subject: string
  description: string
  body: string
}

export default async function EmailTemplatesPage({
  params,
}: {
  params: Promise<{ acronym: string }>
}) {
  const { acronym } = await params

  const raw = await cypher(
    `MATCH (t:EmailTemplate)
     RETURN t.id AS id, t.name AS name, t.subject AS subject,
            t.description AS description, t.body AS body`,
    ["id", "name", "subject", "description", "body"]
  )

  const templates: TemplateRow[] = raw.map((r) => ({
    id: String(r.id ?? ""),
    name: String(r.name ?? ""),
    subject: String(r.subject ?? ""),
    description: String(r.description ?? ""),
    body: String(r.body ?? ""),
  }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Email Templates</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {templates.length} template{templates.length !== 1 ? "s" : ""} available
          </p>
        </div>
        <AddEmailTemplateDialog acronym={acronym} />
      </div>

      {templates.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 px-6 py-10 text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No email templates yet. Templates can be created via the Workflow Config chat.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Name</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Subject</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Description</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {templates.map((t, i) => (
                <tr
                  key={i}
                  className={i < templates.length - 1 ? "border-b border-zinc-100 dark:border-zinc-800" : ""}
                >
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{t.name}</td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{t.subject || "—"}</td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 text-xs">{t.description || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <AddEmailTemplateDialog acronym={acronym} template={t} />
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
