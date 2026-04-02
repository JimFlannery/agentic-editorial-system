/**
 * POST /api/admin/workflow-chat
 *
 * Claude agent for admin workflow configuration.
 * Claude uses tool calls to read and mutate the workflow graph.
 * Mutations are staged and described in plain language before the admin confirms.
 *
 * Request body:
 *   { messages: Message[], journalId: string }
 *
 * Response: newline-delimited JSON stream
 *   Each line is one of:
 *     { type: "text", content: string }
 *     { type: "tool_use", name: string, input: unknown }
 *     { type: "workflow", steps: WorkflowStep[] }
 *     { type: "staged", mutations: StagedMutation[], summary: string }
 *     { type: "error", message: string }
 */

import Anthropic from "@anthropic-ai/sdk"
import { sql, cypher, cypherMutate } from "@/lib/graph"

const client = new Anthropic()

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Message {
  role: "user" | "assistant"
  content: string
}

export interface WorkflowStep {
  order: number
  label: string
  type: "action" | "gate" | "communication"
  branches?: { outcome: string; next: string }[]
}

export interface StagedMutation {
  description: string
  cypher: string
}

// ---------------------------------------------------------------------------
// Gate types registry (from domain model)
// ---------------------------------------------------------------------------

const GATE_TYPES = [
  {
    type: "COUNT_THRESHOLD_BY_DEADLINE",
    description: "Passes when N entities reach a target status before a deadline",
    required_properties: ["minimum", "entity", "status_filter", "deadline_days"],
  },
  {
    type: "ALL_COMPLETE",
    description: "Passes when every linked entity has status = complete",
    required_properties: ["entity"],
  },
  {
    type: "ANY_OF",
    description: "Passes when at least one linked entity has status = complete",
    required_properties: ["entity"],
  },
  {
    type: "DEADLINE_PASSED",
    description: "Passes when current time exceeds deadline property",
    required_properties: ["deadline_days"],
  },
  {
    type: "MANUAL_APPROVAL",
    description: "Passes when a Person node explicitly releases the gate",
    required_properties: [],
  },
  {
    type: "EXTERNAL_SIGNAL",
    description: "Passes when a webhook or API call sets outcome = PASS",
    required_properties: [],
  },
]

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

async function getWorkflow(journalId: string): Promise<unknown> {
  // Fetch WorkflowDefinition nodes for this journal
  const definitions = await cypher(
    `MATCH (w:WorkflowDefinition {journal_id: '${journalId}'})
     RETURN w.name AS name, w.id AS id, w.manuscript_type AS manuscript_type`,
    ["name", "id", "manuscript_type"]
  )

  if (definitions.length === 0) {
    return { workflows: [], message: "No workflows defined for this journal yet." }
  }

  // For each workflow, fetch its steps
  const workflows = await Promise.all(
    definitions.map(async (def) => {
      const steps = await cypher(
        `MATCH (w:WorkflowDefinition {id: '${def.id}'})-[:FIRST_STEP]->(first)
         OPTIONAL MATCH (first)-[:NEXT*0..20]->(step)
         RETURN step.name AS label, step.position AS position, labels(step) AS node_labels`,
        ["label", "position", "node_labels"]
      )
      return { ...def, steps }
    })
  )

  return { workflows }
}

async function describeWorkflow(journalId: string, workflowId: string): Promise<string> {
  const stepBase = await cypher(
    `MATCH (w:WorkflowDefinition {id: '${workflowId}'})
     OPTIONAL MATCH (w)-[:FIRST_STEP]->(first)
     OPTIONAL MATCH (first)-[:NEXT*0..20]->(step)
     RETURN step.name AS label, step.step_type AS type, step.position AS position`,
    ["label", "type", "position"]
  )
  const branchGroups = await Promise.all(
    ["ON_PASS", "ON_FAIL", "ON_ESCALATE", "ON_TIMEOUT"].map((rel) =>
      cypher(
        `MATCH (step)-[:${rel}]->(next) RETURN step.label AS label, '${rel}' AS branch_type, next.label AS next_label`,
        ["label", "branch_type", "next_label"]
      )
    )
  )
  const branchMap = new Map<string, { branch_type: string; next_label: string }>()
  for (const group of branchGroups) {
    for (const b of group) {
      branchMap.set(String(b.label), { branch_type: String(b.branch_type), next_label: String(b.next_label) })
    }
  }
  const steps = stepBase.map((s) => ({
    label: String(s.label ?? ""),
    type: s.type as string | undefined,
    position: s.position,
    ...(branchMap.get(String(s.label)) ?? {}),
  }))

  if (steps.length === 0) {
    return "This workflow has no steps defined yet."
  }

  const lines: string[] = ["Workflow steps:"]
  let order = 1
  for (const step of steps) {
    lines.push(`${order}. [${step.type ?? "action"}] ${step.label}`)
    if (step.branch_type && step.next_label) {
      const symbol =
        step.branch_type === "ON_PASS" ? "PASS"
        : step.branch_type === "ON_FAIL" ? "FAIL"
        : step.branch_type === "ON_ESCALATE" ? "ESCALATE"
        : "TIMEOUT"
      lines.push(`   └── ${symbol} → ${step.next_label}`)
    }
    order++
  }
  return lines.join("\n")
}

async function queryManuscripts(
  journalId: string,
  status?: string,
  limit = 15
): Promise<unknown> {
  const manuscripts = await sql<{
    id: string
    title: string
    status: string
    manuscript_type: string
    submitted_at: string
    updated_at: string
    assigned_editor_id: string | null
  }>(
    `SELECT id, title, status, manuscript_type, submitted_at, updated_at, assigned_editor_id
     FROM manuscript.manuscripts
     WHERE journal_id = $1
       AND ($2::text IS NULL OR status = $2)
     ORDER BY updated_at ASC
     LIMIT $3`,
    [journalId, status ?? null, limit]
  ).catch(() => [])

  // Find gates with no outcome (potentially stuck)
  const stuckGates = await cypher(
    `MATCH (m:Manuscript {journal_id: '${journalId}'})-[*1..5]->(g:Gate)
     WHERE g.outcome IS NULL
     RETURN m.id AS manuscript_id, g.type AS gate_type, g.trigger_event AS trigger`,
    ["manuscript_id", "gate_type", "trigger"]
  ).catch(() => [])

  const gateMap = new Map<string, Record<string, unknown>[]>()
  for (const gate of stuckGates) {
    const id = String(gate.manuscript_id)
    if (!gateMap.has(id)) gateMap.set(id, [])
    gateMap.get(id)!.push(gate)
  }

  return manuscripts.map((m) => ({
    ...m,
    stuck_at_gates: gateMap.get(m.id) ?? [],
  }))
}

async function getManuscriptDetails(
  journalId: string,
  manuscriptId: string
): Promise<unknown> {
  const rows = await sql<{
    id: string
    title: string
    status: string
    manuscript_type: string
    submitted_at: string
    updated_at: string
    assigned_editor_id: string | null
  }>(
    `SELECT id, title, status, manuscript_type, submitted_at, updated_at, assigned_editor_id
     FROM manuscript.manuscripts
     WHERE id = $1 AND journal_id = $2`,
    [manuscriptId, journalId]
  ).catch(() => [])

  if (rows.length === 0) {
    return { error: `Manuscript ${manuscriptId} not found in journal ${journalId}` }
  }

  const [gates, tasks, reviews] = await Promise.all([
    cypher(
      `MATCH (m:Manuscript {id: '${manuscriptId}'})-[*1..5]->(g:Gate)
       RETURN g.type AS type, g.trigger_event AS trigger_event, g.outcome AS outcome,
              g.evaluated_at AS evaluated_at, g.minimum AS minimum,
              g.entity AS entity, g.deadline_days AS deadline_days`,
      ["type", "trigger_event", "outcome", "evaluated_at", "minimum", "entity", "deadline_days"]
    ).catch(() => []),
    cypher(
      `MATCH (m:Manuscript {id: '${manuscriptId}'})-[:HAS_TASK]->(t:Task)
       RETURN t.name AS name, t.status AS status, t.deadline AS deadline, t.assigned_to AS assigned_to`,
      ["name", "status", "deadline", "assigned_to"]
    ).catch(() => []),
    cypher(
      `MATCH (r:Reviewer)-[:INVITED_TO_REVIEW]->(m:Manuscript {id: '${manuscriptId}'})
       RETURN r.name AS reviewer, r.id AS reviewer_id`,
      ["reviewer", "reviewer_id"]
    ).catch(() => []),
  ])

  return {
    manuscript: rows[0],
    gates,
    tasks,
    review_invitations: reviews,
  }
}

async function getManuscriptHistory(
  manuscriptId: string,
  limit = 20
): Promise<unknown> {
  const events = await sql<{
    id: string
    event_type: string
    actor_type: string
    payload: unknown
    created_at: string
  }>(
    `SELECT id, event_type, actor_type, payload, created_at
     FROM history.events
     WHERE payload->>'manuscript_id' = $1
        OR payload->>'id' = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [manuscriptId, limit]
  ).catch(() => [])

  return { manuscript_id: manuscriptId, events }
}

async function listEmailTemplates(journalId: string): Promise<unknown> {
  const templates = await cypher(
    `MATCH (t:EmailTemplate {journal_id: '${journalId}'}) RETURN t.name AS name, t.subject AS subject`,
    ["name", "subject"]
  )
  const sqlTemplates = await sql<{ name: string; subject: string }>(
    `SELECT name, subject FROM manuscript.email_templates WHERE journal_id = $1`,
    [journalId]
  ).catch(() => []) // table may not exist yet
  return { graph_templates: templates, sql_templates: sqlTemplates }
}

function stageMutations(mutations: StagedMutation[]): { staged: StagedMutation[]; summary: string } {
  const summary = mutations
    .map((m, i) => `${i + 1}. ${m.description}`)
    .join("\n")
  return { staged: mutations, summary }
}

async function commitMutations(
  journalId: string,
  mutations: StagedMutation[]
): Promise<{ committed: number; errors: string[] }> {
  const errors: string[] = []
  let committed = 0

  for (const mutation of mutations) {
    try {
      await cypherMutate(mutation.cypher)
      committed++
    } catch (err) {
      errors.push(`Failed: ${mutation.description} — ${(err as Error).message}`)
    }
  }

  // Log to history
  if (committed > 0) {
    await sql(
      `INSERT INTO history.events (journal_id, event_type, actor_type, payload)
       VALUES ($1, 'workflow.mutated', 'agent', $2)`,
      [journalId, JSON.stringify({ mutations_applied: committed, mutations_failed: errors.length })]
    ).catch(() => {})
  }

  return { committed, errors }
}

// ---------------------------------------------------------------------------
// Tool definitions for Claude
// ---------------------------------------------------------------------------

const tools: Anthropic.Tool[] = [
  {
    name: "get_workflow",
    description:
      "Fetch all WorkflowDefinition nodes for the current journal from the graph. " +
      "Returns workflow names, IDs, and their associated steps.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "describe_workflow",
    description:
      "Convert a workflow subgraph into a human-readable linear step list. " +
      "Use this to show the admin what a workflow currently looks like.",
    input_schema: {
      type: "object" as const,
      properties: {
        workflow_id: {
          type: "string",
          description: "The graph node ID of the WorkflowDefinition to describe",
        },
      },
      required: ["workflow_id"],
    },
  },
  {
    name: "list_gate_types",
    description: "Return all available Gate node types and their required properties.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "list_email_templates",
    description: "Return all email templates available to this journal.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "stage_mutations",
    description:
      "Prepare Cypher graph mutations without applying them. " +
      "Returns a plain-language summary of what will change for admin review. " +
      "The admin must explicitly confirm before you call commit_mutations.",
    input_schema: {
      type: "object" as const,
      properties: {
        mutations: {
          type: "array",
          description: "List of mutations to stage",
          items: {
            type: "object",
            properties: {
              description: {
                type: "string",
                description: "Plain-language description of what this mutation does",
              },
              cypher: {
                type: "string",
                description: "The Cypher statement to execute (without the cypher() wrapper)",
              },
            },
            required: ["description", "cypher"],
          },
        },
      },
      required: ["mutations"],
    },
  },
  {
    name: "commit_mutations",
    description:
      "Apply previously staged mutations to the graph. " +
      "ONLY call this after the admin has explicitly confirmed they want to apply the changes.",
    input_schema: {
      type: "object" as const,
      properties: {
        mutations: {
          type: "array",
          description: "The exact mutations array returned by stage_mutations",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              cypher: { type: "string" },
            },
            required: ["description", "cypher"],
          },
        },
      },
      required: ["mutations"],
    },
  },
  {
    name: "query_manuscripts",
    description:
      "Find manuscripts for this journal. Use to diagnose problems — e.g. find stuck, overdue, or unassigned manuscripts. " +
      "Returns manuscript metadata plus any gates with no recorded outcome.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          description: "Optional status filter (e.g. 'under_review', 'awaiting_decision'). Omit to return all statuses.",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return. Defaults to 15.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_manuscript_details",
    description:
      "Get the full current state of a specific manuscript: metadata, active gates and their outcomes, " +
      "open tasks, and reviewer invitations. Use this to diagnose why a manuscript is stuck or stalled.",
    input_schema: {
      type: "object" as const,
      properties: {
        manuscript_id: {
          type: "string",
          description: "The ID of the manuscript to inspect",
        },
      },
      required: ["manuscript_id"],
    },
  },
  {
    name: "get_manuscript_history",
    description:
      "Fetch the event log for a specific manuscript from the history table. " +
      "Useful for understanding what happened and when, and for diagnosing where a workflow went wrong.",
    input_schema: {
      type: "object" as const,
      properties: {
        manuscript_id: {
          type: "string",
          description: "The ID of the manuscript",
        },
        limit: {
          type: "number",
          description: "Number of events to return, most recent first. Defaults to 20.",
        },
      },
      required: ["manuscript_id"],
    },
  },
]

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an editorial assistant for an academic journal management system. You have two modes: workflow configuration and troubleshooting.

## Mode 1 — Workflow configuration
Help administrators define and modify manuscript review workflows using plain language. The workflows are stored as a property graph (Apache AGE / Cypher). You are the translation layer.

- Listen to the admin describe their workflow in natural language
- Use get_workflow / describe_workflow to read current state before making changes
- Stage mutations as discrete named steps with plain-language descriptions
- Always show a summary of staged changes and wait for explicit confirmation before calling commit_mutations
- After committing, describe what changed in plain language

Workflow rules:
- Every workflow belongs to the current journal (journal_id is in context)
- Steps connect via [:NEXT]; gates use [:ON_PASS], [:ON_FAIL], [:ON_ESCALATE], [:ON_TIMEOUT]
- Gate nodes require a type — call list_gate_types if unsure

## Mode 2 — Troubleshooting
When an admin reports a problem ("manuscript X is stuck", "reviewer never got an invitation", "decision hasn't gone out"), diagnose and fix it.

Diagnostic approach:
1. Call query_manuscripts to find affected manuscripts (filter by status if the admin specifies one)
2. Call get_manuscript_details on the specific manuscript to see its gate states, tasks, and reviewer invitations
3. Call get_manuscript_history to see the event log and identify where things went wrong
4. Explain clearly what you found: which gate is stuck, what was expected vs. what happened, why
5. If a fix is needed, stage the corrective mutations and describe them in plain language before committing

Common problems and fixes:
- Gate stuck with no outcome: MATCH the gate node, SET g.outcome = 'PASS' (or appropriate outcome) to unblock it
- Missing task or assignment: CREATE the missing Task node and relate it to the Manuscript
- Reviewer invitation not sent: Check review_invitations in get_manuscript_details; stage the missing [:INVITED_TO_REVIEW] relationship
- Wrong status on manuscript: MATCH the Manuscript, SET m.status = 'correct_status'

## Cypher syntax rules (Apache AGE dialect)
- Single quotes only: {name: 'value'} NOT {name: "value"}
- No SQL functions inside Cypher (no gen_random_uuid(), no now())
- Use string IDs derived from journal_id: e.g. {id: 'journal-id/node-name'}
- One CREATE or MATCH...SET per mutation
- Do NOT wrap queries in SELECT * FROM cypher(...)

## Confirm-before-commit rule
NEVER call commit_mutations without first calling stage_mutations and receiving explicit confirmation ("yes", "confirm", "apply", "do it"). Do NOT stage again after confirmation — go straight to commit_mutations.

## Tone
Be concise. Admins are editorial domain experts, not engineers. Avoid graph/database jargon. When reporting a diagnosis, lead with what's wrong and what you can do to fix it.`

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const { messages, journalId } = await req.json() as {
    messages: Message[]
    journalId: string
  }

  if (!journalId) {
    return Response.json({ error: "journalId is required" }, { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function emit(obj: unknown) {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"))
      }

      try {
        // Agentic loop: keep going until Claude stops using tools
        const conversationMessages: Anthropic.MessageParam[] = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }))

        while (true) {
          const response = await client.messages.create({
            model: "claude-opus-4-6",
            max_tokens: 8096,
            system: SYSTEM_PROMPT + `\n\nCurrent journal_id: ${journalId}`,
            tools,
            messages: conversationMessages,
          })

          // Collect text and tool use from this turn
          let textBuffer = ""
          const toolUses: Anthropic.ToolUseBlock[] = []

          for (const block of response.content) {
            if (block.type === "text") {
              textBuffer += block.text
            } else if (block.type === "tool_use") {
              toolUses.push(block)
            }
          }

          if (textBuffer) {
            emit({ type: "text", content: textBuffer })
          }

          // If no tool calls, we're done
          if (toolUses.length === 0) break

          // Add Claude's response to conversation history
          conversationMessages.push({ role: "assistant", content: response.content })

          // Execute each tool and collect results
          const toolResults: Anthropic.ToolResultBlockParam[] = []

          for (const toolUse of toolUses) {
            emit({ type: "tool_use", name: toolUse.name, input: toolUse.input })

            let result: unknown
            try {
              const input = toolUse.input as Record<string, unknown>

              switch (toolUse.name) {
                case "get_workflow":
                  result = await getWorkflow(journalId)
                  break
                case "describe_workflow":
                  result = await describeWorkflow(journalId, input.workflow_id as string)
                  break
                case "list_gate_types":
                  result = GATE_TYPES
                  break
                case "list_email_templates":
                  result = await listEmailTemplates(journalId)
                  break
                case "stage_mutations": {
                  const staged = stageMutations(input.mutations as StagedMutation[])
                  emit({ type: "staged", mutations: staged.staged, summary: staged.summary })
                  result = staged
                  break
                }
                case "commit_mutations":
                  result = await commitMutations(journalId, input.mutations as StagedMutation[])
                  break
                case "query_manuscripts":
                  result = await queryManuscripts(
                    journalId,
                    input.status as string | undefined,
                    input.limit as number | undefined
                  )
                  break
                case "get_manuscript_details":
                  result = await getManuscriptDetails(journalId, input.manuscript_id as string)
                  break
                case "get_manuscript_history":
                  result = await getManuscriptHistory(
                    input.manuscript_id as string,
                    input.limit as number | undefined
                  )
                  break
                default:
                  result = { error: `Unknown tool: ${toolUse.name}` }
              }
            } catch (err) {
              result = { error: (err as Error).message }
            }

            toolResults.push({
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: JSON.stringify(result),
            })
          }

          // Add tool results to conversation and continue loop
          conversationMessages.push({ role: "user", content: toolResults })
        }
      } catch (err) {
        emit({ type: "error", message: (err as Error).message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  })
}
