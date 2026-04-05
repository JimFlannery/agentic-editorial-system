import { WorkflowChat } from "@/components/workflow-chat"
import { sql } from "@/lib/graph"

export default async function TroubleshootingPage({
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
      <p className="text-sm text-muted-foreground">
        No journals found. <a href="/admin/journals" className="underline underline-offset-2 hover:text-foreground">Add a journal first.</a>
      </p>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Troubleshooting</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Describe a problem and Claude will diagnose it — querying manuscripts, gates, and the event log to find the root cause.
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden" style={{ height: "70vh" }}>
        <WorkflowChat
          journalId={journal.id}
          journalName={journal.name}
          apiPath="/api/admin/troubleshooting-chat"
          headerLabel="Troubleshooting"
          placeholder="Describe the problem — e.g. 'Manuscript JOR-2024-001 has been stuck under review for 6 weeks' (Enter to send)"
        />
      </div>
    </div>
  )
}
