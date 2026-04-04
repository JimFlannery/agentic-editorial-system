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
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Submission Form Fields
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {activeCount} active field{activeCount !== 1 ? "s" : ""} · drag to reorder
          </p>
        </div>
        <FieldDialog journalId={journal.id} />
      </div>

      {/* Fixed fields note */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-3 mb-4">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Always present:</span>{" "}
          Title, abstract, authors &amp; affiliations, manuscript type, and main file upload
          are hardcoded and not configurable here.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
          <div className="w-4" /> {/* grip placeholder */}
          <span className="flex-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">Label</span>
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 w-20 text-right">Key</span>
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 w-20 text-right">Type</span>
          <div className="w-24" /> {/* actions placeholder */}
        </div>

        <FieldList fields={fields} journalId={journal.id} />
      </div>
    </div>
  )
}
