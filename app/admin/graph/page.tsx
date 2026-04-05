import { cypher } from "@/lib/graph"
import GraphViewer, { type GraphNode, type GraphEdge } from "@/components/graph-viewer"

function nodeLabel(nodeType: string, props: Record<string, unknown>): string {
  if (typeof props.name === "string") return props.name
  if (typeof props.title === "string") return props.title
  if (typeof props.type === "string") return `${nodeType}: ${props.type}`
  return nodeType
}

const LEGEND = [
  { label: "Person", color: "#6366f1" },
  { label: "Manuscript", color: "#f59e0b" },
  { label: "Gate", color: "#ef4444" },
  { label: "WorkflowDefinition", color: "#10b981" },
  { label: "Task", color: "#3b82f6" },
  { label: "Review", color: "#8b5cf6" },
  { label: "EmailTemplate", color: "#ec4899" },
  { label: "Journal", color: "#14b8a6" },
]

export default async function GraphPage() {
  let nodes: GraphNode[] = []
  let edges: GraphEdge[] = []
  let error: string | null = null

  try {
    const [nodeRows, edgeRows] = await Promise.all([
      cypher("MATCH (n) RETURN n", ["n"]),
      cypher("MATCH ()-[e]->() RETURN e", ["e"]),
    ])

    nodes = nodeRows.map((row) => {
      const n = row.n as {
        id: number
        label: string
        properties: Record<string, unknown>
      }
      return {
        key: String(n.id),
        label: nodeLabel(n.label, n.properties),
        nodeType: n.label,
        properties: n.properties,
      }
    })

    edges = edgeRows.map((row) => {
      const e = row.e as {
        id: number
        label: string
        start_id: number
        end_id: number
        properties: Record<string, unknown>
      }
      return {
        key: String(e.id),
        source: String(e.start_id),
        target: String(e.end_id),
        label: e.label,
      }
    })
  } catch (err) {
    error = err instanceof Error ? err.message : "Unknown error"
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-1">
        Graph View
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        Read-only visualisation of the workflow graph. Click a node to inspect its properties.
      </p>

      {error ? (
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 p-6">
          <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">
            Could not load graph
          </p>
          <p className="text-xs text-red-600 dark:text-red-500 font-mono">{error}</p>
        </div>
      ) : nodes.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No graph data. Use Workflow Config to define a workflow and populate the graph.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-4 mb-4">
            {LEGEND.map(({ label, color }) => (
              <span
                key={label}
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                {label}
              </span>
            ))}
            <span className="ml-auto text-xs text-muted-foreground">
              {nodes.length} nodes · {edges.length} edges
            </span>
          </div>
          <GraphViewer nodes={nodes} edges={edges} />
        </>
      )}
    </div>
  )
}
