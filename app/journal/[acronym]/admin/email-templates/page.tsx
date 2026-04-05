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
          <h1 className="text-xl font-semibold text-foreground">Email Templates</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {templates.length} template{templates.length !== 1 ? "s" : ""} available
          </p>
        </div>
        <AddEmailTemplateDialog acronym={acronym} />
      </div>

      {templates.length === 0 ? (
        <div className="rounded-xl border border-border px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No email templates yet. Templates can be created via the Workflow Config chat.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Subject</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Description</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {templates.map((t, i) => (
                <tr
                  key={i}
                  className={i < templates.length - 1 ? "border-b border-border/50" : ""}
                >
                  <td className="px-4 py-3 font-medium text-foreground">{t.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.subject || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{t.description || "—"}</td>
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
