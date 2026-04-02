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
  const steps = stepBase.map((s) => ({ ...s, ...(branchMap.get(String(s.label)) ?? {}) }))

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
]

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an editorial workflow configuration assistant for an academic journal management system.

You help journal administrators define and modify manuscript review workflows using plain language. The workflows are stored as a property graph (using Apache AGE / Cypher). You are the translation layer between plain language and the graph.

## Your responsibilities
- Listen to the admin describe their workflow in natural language
- Use your tools to read the current workflow state
- Stage mutations as discrete, named steps with plain-language descriptions
- Always show the admin a summary of staged changes and wait for explicit confirmation ("yes", "confirm", "apply") before calling commit_mutations
- After committing, describe what was changed in plain language

## Workflow building rules
- Every workflow belongs to the current journal (journal_id is provided in context)
- Workflows have a name and manuscript_type (e.g. "research_article", "review_article")
- Steps are connected by [:NEXT] relationships
- Gates use typed outcome relationships: [:ON_PASS], [:ON_FAIL], [:ON_ESCALATE], [:ON_TIMEOUT]
- Gate nodes require a type property — always call list_gate_types if unsure what types are available

## Cypher syntax rules (Apache AGE dialect)
- Use single quotes for all string values: {name: 'value'} NOT {name: "value"}
- Do NOT use SQL functions like gen_random_uuid() — AGE does not support SQL functions in Cypher
- Use simple string IDs derived from the journal_id and a short name: e.g. {id: 'journal-id/standard-workflow'}
- Every CREATE statement must be a plain Cypher expression with no RETURN clause
- Keep each mutation to a single CREATE or MATCH...CREATE or MATCH...SET statement
- Do NOT wrap queries in SELECT * FROM cypher(...) — that is handled by the system

## Confirm-before-commit rule
NEVER call commit_mutations without first calling stage_mutations and receiving an explicit confirmation from the admin. If the admin says "yes", "confirm", "apply", "do it", or similar — that counts as confirmation. Do NOT stage again after confirmation — call commit_mutations directly.

## Tone
Be concise and practical. Admins are domain experts (editors, journal managers), not graph engineers. Avoid technical jargon. When showing staged changes, use the numbered linear format from the system documentation.`

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
