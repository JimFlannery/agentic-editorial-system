import { WorkflowChat } from "@/components/workflow-chat"
import { sql } from "@/lib/graph"

// For now, use the seed journal. Replace with session-based journal selection later.
const DEMO_JOURNAL_ID = "00000000-0000-0000-0000-000000000001"

export default async function WorkflowConfigPage() {
  const journals = await sql<{ id: string; name: string }>(
    "SELECT id, name FROM manuscript.journals WHERE id = $1",
    [DEMO_JOURNAL_ID]
  )
  const journal = journals[0]

  if (!journal) {
    return <p className="text-sm text-zinc-400">No journal found.</p>
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
