import { cypher } from "@/lib/graph"
import { AddEmailTemplateDialog } from "./add-email-template-dialog"

interface TemplateRow {
  id: unknown
  name: unknown
  subject: unknown
  description: unknown
}

export default async function EmailTemplatesPage() {
  const templates = await cypher(
    `MATCH (t:EmailTemplate)
     RETURN t.id AS id, t.name AS name, t.subject AS subject, t.description AS description`,
    ["id", "name", "subject", "description"]
  ) as TemplateRow[]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Email Templates</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {templates.length} template{templates.length !== 1 ? "s" : ""} available
          </p>
        </div>
        <AddEmailTemplateDialog />
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
              </tr>
            </thead>
            <tbody>
              {templates.map((t, i) => (
                <tr
                  key={i}
                  className={i < templates.length - 1 ? "border-b border-zinc-100 dark:border-zinc-800" : ""}
                >
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                    {String(t.name)}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                    {t.subject ? String(t.subject) : "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 text-xs">
                    {t.description ? String(t.description) : "—"}
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
