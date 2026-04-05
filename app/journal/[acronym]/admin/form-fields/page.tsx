import { notFound } from "next/navigation"
import { sql } from "@/lib/graph"
import { FieldList } from "./field-list"
import { FieldDialog } from "./field-dialog"

interface FormField {
  id: string
  field_key: string
  label: string
  description: string | null
  field_type: string
  required: boolean
  active: boolean
  options: string[] | null
}

export default async function FormFieldsPage({
  params,
}: {
  params: Promise<{ acronym: string }>
}) {
  const { acronym } = await params

  const journalRows = await sql<{ id: string; name: string }>(
    "SELECT id, name FROM manuscript.journals WHERE UPPER(acronym) = UPPER($1)",
    [acronym]
  )
  const journal = journalRows[0]
  if (!journal) notFound()

  const fields = await sql<FormField>(`
    SELECT id, field_key, label, description, field_type, required, active,
           options::jsonb AS options
    FROM manuscript.form_fields
    WHERE journal_id = $1
      AND form_type = 'submission'
    ORDER BY display_order, created_at
  `, [journal.id])

  const activeCount = fields.filter((f) => f.active).length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Submission Form Fields
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeCount} active field{activeCount !== 1 ? "s" : ""} · drag to reorder
          </p>
        </div>
        <FieldDialog journalId={journal.id} />
      </div>

      {/* Fixed fields note */}
      <div className="rounded-xl border border-border bg-muted/50 px-4 py-3 mb-4">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Always present:</span>{" "}
          Title, abstract, authors &amp; affiliations, manuscript type, and main file upload
          are hardcoded and not configurable here.
        </p>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-muted">
          <div className="w-4" /> {/* grip placeholder */}
          <span className="flex-1 text-xs font-medium text-muted-foreground">Label</span>
          <span className="text-xs font-medium text-muted-foreground w-20 text-right">Key</span>
          <span className="text-xs font-medium text-muted-foreground w-20 text-right">Type</span>
          <div className="w-24" /> {/* actions placeholder */}
        </div>

        <FieldList fields={fields} journalId={journal.id} />
      </div>
    </div>
  )
}
