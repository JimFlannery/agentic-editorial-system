"use client"

import { useEffect, useState } from "react"
import Graph from "graphology"
import { SigmaContainer, useLoadGraph, useRegisterEvents } from "@react-sigma/core"
import { useWorkerLayoutForceAtlas2 } from "@react-sigma/layout-forceatlas2"
import "@react-sigma/core/lib/style.css"

export interface GraphNode {
  key: string
  label: string
  nodeType: string
  properties: Record<string, unknown>
}

export interface GraphEdge {
  key: string
  source: string
  target: string
  label: string
}

const NODE_COLORS: Record<string, string> = {
  Person: "#6366f1",
  Manuscript: "#f59e0b",
  Gate: "#ef4444",
  WorkflowDefinition: "#10b981",
  Task: "#3b82f6",
  Review: "#8b5cf6",
  EmailTemplate: "#ec4899",
  Journal: "#14b8a6",
}

// ---------------------------------------------------------------------------
// Inner components (must be children of SigmaContainer to access context)
// ---------------------------------------------------------------------------

function LoadGraph({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const loadGraph = useLoadGraph()

  useEffect(() => {
    const graph = new Graph()

    nodes.forEach((n) => {
      graph.addNode(n.key, {
        label: n.label,
        size: 6,
        color: NODE_COLORS[n.nodeType] ?? "#94a3b8",
        x: Math.random() * 100,
        y: Math.random() * 100,
      })
    })

    edges.forEach((e) => {
      if (graph.hasNode(e.source) && graph.hasNode(e.target)) {
        try {
          graph.addEdgeWithKey(e.key, e.source, e.target, {
            label: e.label,
            size: 1,
            color: "#d4d4d8",
          })
        } catch {
          // ignore duplicate edges
        }
      }
    })

    loadGraph(graph)
  }, [loadGraph, nodes, edges])

  return null
}

function GraphLayout() {
  const { start, kill } = useWorkerLayoutForceAtlas2({
    settings: { slowDown: 10, gravity: 1, scalingRatio: 2 },
  })

  useEffect(() => {
    start()
    const timeout = setTimeout(() => kill(), 3000)
    return () => {
      clearTimeout(timeout)
      kill()
    }
  }, [start, kill])

  return null
}

function GraphEvents({
  onNodeClick,
  onStageClick,
}: {
  onNodeClick: (key: string) => void
  onStageClick: () => void
}) {
  const registerEvents = useRegisterEvents()

  useEffect(() => {
    registerEvents({
      clickNode: (e) => onNodeClick(e.node),
      clickStage: () => onStageClick(),
    })
  }, [registerEvents, onNodeClick, onStageClick])

  return null
}

// ---------------------------------------------------------------------------
// Inspector panel
// ---------------------------------------------------------------------------

function Inspector({ node, onClose }: { node: GraphNode; onClose: () => void }) {
  return (
    <div className="w-72 shrink-0 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 overflow-auto">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
          {node.nodeType}
        </span>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm leading-none"
          aria-label="Close inspector"
        >
          ✕
        </button>
      </div>
      <p className="font-medium text-zinc-900 dark:text-zinc-100 text-sm mb-4 break-words">
        {node.label}
      </p>
      {Object.keys(node.properties).length > 0 ? (
        <dl className="space-y-2">
          {Object.entries(node.properties).map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-zinc-400 mb-0.5">{k}</dt>
              <dd className="text-xs text-zinc-700 dark:text-zinc-300 break-all font-mono">
                {v === null || v === undefined ? (
                  <span className="text-zinc-400 italic">null</span>
                ) : typeof v === "object" ? (
                  JSON.stringify(v)
                ) : (
                  String(v)
                )}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-xs text-zinc-400 italic">No properties</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export default function GraphViewer({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const selectedNode = nodes.find((n) => n.key === selectedKey) ?? null

  return (
    <div className="flex gap-4" style={{ height: "600px" }}>
      <SigmaContainer
        style={{ flex: 1, borderRadius: "12px", border: "1px solid #e4e4e7" }}
        settings={{
          allowInvalidContainer: true,
          defaultEdgeType: "arrow",
          renderEdgeLabels: true,
          labelSize: 11,
          labelWeight: "normal",
          defaultEdgeColor: "#d4d4d8",
        }}
      >
        <LoadGraph nodes={nodes} edges={edges} />
        <GraphLayout />
        <GraphEvents
          onNodeClick={setSelectedKey}
          onStageClick={() => setSelectedKey(null)}
        />
      </SigmaContainer>

      {selectedNode && (
        <Inspector node={selectedNode} onClose={() => setSelectedKey(null)} />
      )}
    </div>
  )
}
