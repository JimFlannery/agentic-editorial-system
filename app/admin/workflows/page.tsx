import { cypher } from "@/lib/graph"

interface NodeRow {
  name: unknown
  position: unknown
  node_type: unknown       // "Step" or "Gate"
  step_type: unknown       // e.g. "intake", "manual"
  gate_type: unknown       // e.g. "COUNT_THRESHOLD_BY_DEADLINE"
  minimum: unknown
  deadline_days: unknown
}

interface BranchRow {
  from_name: unknown
  rel: unknown
  to_name: unknown
}

interface WorkflowNode {
  name: string
  position: number
  node_type: "Step" | "Gate"
  step_type: string | null
  gate_type: string | null
  minimum: number | null
  deadline_days: number | null
  branches: { outcome: string; to: string }[]
}

interface Workflow {
  id: string
  name: string
  manuscript_type: string
  journal_id: string
  description: string | null
  nodes: WorkflowNode[]
}

function gateDescription(node: WorkflowNode): string {
  if (node.gate_type === "COUNT_THRESHOLD_BY_DEADLINE") {
    return `Wait for ${node.minimum ?? "?"} reviews within ${node.deadline_days ?? "?"} days`
  }
  if (node.gate_type === "ALL_COMPLETE") return "All items complete?"
  if (node.gate_type === "ANY_OF") return "Any item complete?"
  if (node.gate_type === "DEADLINE_PASSED") return `Deadline passed (${node.deadline_days ?? "?"} days)?`
  if (node.gate_type === "MANUAL_APPROVAL") return "Awaiting manual approval"
  if (node.gate_type === "EXTERNAL_SIGNAL") return "Awaiting external signal"
  return node.name
}

function outcomeLabel(rel: string): string {
  return rel.replace("ON_", "")
}

function outcomeColor(rel: string): string {
  if (rel === "ON_PASS") return "text-green-600 dark:text-green-400"
  if (rel === "ON_FAIL") return "text-red-500 dark:text-red-400"
  if (rel === "ON_ESCALATE") return "text-orange-500 dark:text-orange-400"
  if (rel === "ON_TIMEOUT") return "text-amber-500 dark:text-amber-400"
  return "text-zinc-400"
}

export default async function WorkflowsPage() {
  const workflowRows = await cypher(
    `MATCH (w:WorkflowDefinition)
     RETURN w.id AS id, w.name AS name, w.manuscript_type AS manuscript_type,
            w.journal_id AS journal_id, w.description AS description`,
    ["id", "name", "manuscript_type", "journal_id", "description"]
  )

  const workflows: Workflow[] = await Promise.all(
    workflowRows.map(async (w) => {
      const wid = String(w.id)

      // Get all step and gate nodes reachable from this workflow, ordered by position
      const nodeRows = await cypher(
        `MATCH (w:WorkflowDefinition {id: '${wid}'})-[:FIRST_STEP]->(first)
         MATCH (first)-[:NEXT*0..20]->(node)
         RETURN node.name AS name, node.position AS position, labels(node) AS node_type,
                node.step_type AS step_type, node.gate_type AS gate_type,
                node.minimum AS minimum, node.deadline_days AS deadline_days`,
        ["name", "position", "node_type", "step_type", "gate_type", "minimum", "deadline_days"]
      ) as NodeRow[]

      // Include the first node itself
      const firstRows = await cypher(
        `MATCH (w:WorkflowDefinition {id: '${wid}'})-[:FIRST_STEP]->(first)
         RETURN first.name AS name, first.position AS position, labels(first) AS node_type,
                first.step_type AS step_type, first.gate_type AS gate_type,
                first.minimum AS minimum, first.deadline_days AS deadline_days`,
        ["name", "position", "node_type", "step_type", "gate_type", "minimum", "deadline_days"]
      ) as NodeRow[]

      // Branches for each outcome type
      const branchGroups = await Promise.all(
        ["ON_PASS", "ON_FAIL", "ON_ESCALATE", "ON_TIMEOUT"].map((rel) =>
          cypher(
            `MATCH (a)-[:${rel}]->(b) RETURN a.name AS from_name, '${rel}' AS rel, b.name AS to_name`,
            ["from_name", "rel", "to_name"]
          )
        )
      ) as BranchRow[][]

      const branchMap = new Map<string, { outcome: string; to: string }[]>()
      for (const group of branchGroups) {
        for (const b of group) {
          const key = String(b.from_name)
          if (!branchMap.has(key)) branchMap.set(key, [])
          branchMap.get(key)!.push({ outcome: String(b.rel), to: String(b.to_name) })
        }
      }

      const allRows = [...firstRows, ...nodeRows]
      // Deduplicate by name and sort by position
      const seen = new Set<string>()
      const nodes: WorkflowNode[] = []
      for (const row of allRows) {
        const name = String(row.name)
        if (seen.has(name)) continue
        seen.add(name)
        const rawLabels = String(row.node_type)
        const isGate = rawLabels.includes("Gate")
        nodes.push({
          name,
          position: Number(row.position) || 0,
          node_type: isGate ? "Gate" : "Step",
          step_type: row.step_type ? String(row.step_type) : null,
          gate_type: row.gate_type ? String(row.gate_type) : null,
          minimum: row.minimum != null ? Number(row.minimum) : null,
          deadline_days: row.deadline_days != null ? Number(row.deadline_days) : null,
          branches: branchMap.get(name) ?? [],
        })
      }
      nodes.sort((a, b) => a.position - b.position)

      return {
        id: wid,
        name: String(w.name),
        manuscript_type: String(w.manuscript_type),
        journal_id: String(w.journal_id),
        description: w.description ? String(w.description) : null,
        nodes,
      }
    })
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Workflows</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {workflows.length} workflow definition{workflows.length !== 1 ? "s" : ""}
          </p>
        </div>
        <a
          href="/admin/workflow"
          className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium px-4 py-2 hover:opacity-90 transition-opacity"
        >
          Configure with AI
        </a>
      </div>

      {workflows.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 px-6 py-10 text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">No workflows defined yet.</p>
          <a
            href="/admin/workflow"
            className="text-sm font-medium text-zinc-900 dark:text-zinc-100 underline underline-offset-2"
          >
            Configure your first workflow →
          </a>
        </div>
      ) : (
        <div className="space-y-6">
          {workflows.map((w) => (
            <div
              key={w.id}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden"
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">{w.name}</p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                    {w.manuscript_type.replace(/_/g, " ")}
                  </p>
                  {w.description && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-2xl leading-relaxed">
                      {w.description}
                    </p>
                  )}
                </div>
                <a
                  href="/admin/workflow"
                  className="shrink-0 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 underline underline-offset-2"
                >
                  Edit
                </a>
              </div>

              {/* Diagram */}
              <div className="px-5 py-5">
                {w.nodes.length === 0 ? (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">No steps defined.</p>
                ) : (
                  <ol className="space-y-1 font-mono text-sm">
                    {w.nodes.map((node, i) => (
                      <li key={node.name}>
                        {node.node_type === "Gate" ? (
                          <div>
                            {/* Gate row */}
                            <div className="flex items-start gap-3">
                              <span className="shrink-0 w-6 h-6 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-xs flex items-center justify-center font-medium mt-0.5">
                                {i + 1}
                              </span>
                              <div className="flex-1">
                                <span className="text-amber-700 dark:text-amber-400 font-medium">
                                  [GATE] {gateDescription(node)}
                                </span>
                                {/* Branch lines */}
                                {node.branches.length > 0 && (
                                  <div className="mt-1.5 ml-4 space-y-1">
                                    {node.branches.map((branch, bi) => (
                                      <div key={bi} className="flex items-center gap-1.5 text-xs">
                                        <span className="text-zinc-300 dark:text-zinc-600">
                                          {bi === node.branches.length - 1 ? "└──" : "├──"}
                                        </span>
                                        <span className={`font-medium ${outcomeColor(branch.outcome)}`}>
                                          {outcomeLabel(branch.outcome)}
                                        </span>
                                        <span className="text-zinc-400 dark:text-zinc-500">→</span>
                                        <span className="text-zinc-600 dark:text-zinc-400">{branch.to}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <span className="shrink-0 w-6 h-6 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-xs flex items-center justify-center font-medium">
                              {i + 1}
                            </span>
                            <span className="text-zinc-800 dark:text-zinc-200">{node.name}</span>
                            {node.step_type && (
                              <span className="text-xs text-zinc-400 dark:text-zinc-600 font-sans">
                                {node.step_type}
                              </span>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
