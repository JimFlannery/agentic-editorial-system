import { WorkflowChat } from "@/components/workflow-chat"
import { sql } from "@/lib/graph"

export default async function WorkflowConfigPage({
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

  if (!journal) {
    return (
      <p className="text-sm text-zinc-400">
        No journals found. <a href="/admin/journals" className="underline underline-offset-2 hover:text-zinc-600">Add a journal first.</a>
      </p>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Workflow Config</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Describe your workflow in plain language — Claude will translate it into the graph.
        </p>
      </div>
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden" style={{ height: "70vh" }}>
        <WorkflowChat journalId={journal.id} journalName={journal.name} />
      </div>
    </div>
  )
}
