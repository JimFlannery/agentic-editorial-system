import { notFound, redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/graph"
import { submitManuscript } from "./actions"
import { SubmitForm } from "./submit-form"

interface ManuscriptType {
  id: string
  name: string
  description: string | null
}

interface FormField {
  id: string
  field_key: string
  label: string
  description: string | null
  field_type: string
  required: boolean
  options: string[] | null
  conditions: { show_if?: { field: string; value: string } } | null
}

export default async function SubmitPage({
  params,
}: {
  params: Promise<{ acronym: string }>
}) {
  const { acronym } = await params

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect(`/login?next=/journal/${acronym}/author/submit`)

  const journalRows = await sql<{ id: string; name: string }>(
    "SELECT id, name FROM manuscript.journals WHERE UPPER(acronym) = UPPER($1)",
    [acronym]
  )
  const journal = journalRows[0]
  if (!journal) notFound()

  const personRows = await sql<{ id: string }>(
    "SELECT id FROM manuscript.people WHERE auth_user_id = $1 AND journal_id = $2",
    [session.user.id, journal.id]
  )
  if (!personRows[0]) {
    return (
      <div className="max-w-lg">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Your account is not provisioned for {acronym}. Contact the editorial office.
        </p>
      </div>
    )
  }

  const [manuscriptTypes, formFields] = await Promise.all([
    sql<ManuscriptType>(`
      SELECT id, name, description
      FROM manuscript.manuscript_types
      WHERE journal_id = $1
      ORDER BY name
    `, [journal.id]),

    sql<FormField>(`
      SELECT id, field_key, label, description, field_type, required,
             options::jsonb AS options,
             conditions::jsonb AS conditions
      FROM manuscript.form_fields
      WHERE journal_id = $1
        AND form_type = 'submission'
        AND active = true
      ORDER BY display_order, created_at
    `, [journal.id]),
  ])

  const action = submitManuscript.bind(null, acronym)

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
        Submit a manuscript
      </h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
        {journal.name}
      </p>

      <SubmitForm
        manuscriptTypes={manuscriptTypes}
        formFields={formFields}
        action={action}
      />
    </div>
  )
}
