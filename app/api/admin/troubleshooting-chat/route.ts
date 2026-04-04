/**
 * POST /api/admin/troubleshooting-chat
 *
 * Claude agent for diagnosing editorial workflow problems.
 * Read-only by default; can stage and apply corrective fixes after diagnosis.
 *
 * Request body:
 *   { messages: Message[], journalId: string }
 *
 * Response: newline-delimited JSON stream (same format as workflow-chat)
 */

import Anthropic from "@anthropic-ai/sdk"
import { sql, cypher, cypherMutate } from "@/lib/graph"
import { requireSystemAdmin } from "@/lib/api-auth"
import type { StagedMutation } from "@/app/api/admin/workflow-chat/route"

const client = new Anthropic()

interface Message {
  role: "user" | "assistant"
  content: string
}

// ---------------------------------------------------------------------------
// Tool implementations (shared read logic; mutations kept for fixes)
// ---------------------------------------------------------------------------

async function queryManuscripts(journalId: string, status?: string, limit = 20) {
  const rows = await sql<{
    id: string; title: string; status: string
    manuscript_type: string; submitted_at: string; updated_at: string
  }>(
    `SELECT id, title, status, manuscript_type, submitted_at, updated_at
     FROM manuscript.manuscripts
     WHERE journal_id = $1
       AND ($2::text IS NULL OR status = $2)
     ORDER BY updated_at ASC
     LIMIT $3`,
    [journalId, status ?? null, limit]
  ).catch(() => [])

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

  return rows.map((m) => ({ ...m, stuck_at_gates: gateMap.get(m.id) ?? [] }))
}

async function getManuscriptDetails(journalId: string, manuscriptId: string) {
  const rows = await sql<{
    id: string; title: string; status: string; manuscript_type: string
    submitted_at: string; updated_at: string
  }>(
    `SELECT id, title, status, manuscript_type, submitted_at, updated_at
     FROM manuscript.manuscripts
     WHERE id = $1 AND journal_id = $2`,
    [manuscriptId, journalId]
  ).catch(() => [])

  if (rows.length === 0) {
    return { error: `Manuscript ${manuscriptId} not found in journal ${journalId}` }
  }

  const [gates, reviews, checklistEvents] = await Promise.all([
    cypher(
      `MATCH (m:Manuscript {id: '${manuscriptId}'})-[*1..5]->(g:Gate)
       RETURN g.type AS type, g.trigger_event AS trigger_event, g.outcome AS outcome,
              g.evaluated_at AS evaluated_at, g.minimum AS minimum,
              g.entity AS entity, g.deadline_days AS deadline_days`,
      ["type", "trigger_event", "outcome", "evaluated_at", "minimum", "entity", "deadline_days"]
    ).catch(() => []),
    cypher(
      `MATCH (r:Person)-[:INVITED_TO_REVIEW]->(m:Manuscript {id: '${manuscriptId}'})
       RETURN r.name AS reviewer, r.sql_id AS reviewer_id`,
      ["reviewer", "reviewer_id"]
    ).catch(() => []),
    sql<{ event_type: string; payload: unknown; occurred_at: string }>(
      `SELECT event_type, payload, occurred_at
       FROM history.events
       WHERE manuscript_id = $1
       ORDER BY occurred_at DESC
       LIMIT 5`,
      [manuscriptId]
    ).catch(() => []),
  ])

  return { manuscript: rows[0], gates, review_invitations: reviews, recent_events: checklistEvents }
}

async function getManuscriptHistory(manuscriptId: string, limit = 25) {
  const events = await sql<{
    id: string; event_type: string; actor_type: string; payload: unknown; occurred_at: string
  }>(
    `SELECT id, event_type, actor_type, payload, occurred_at
     FROM history.events
     WHERE manuscript_id = $1
     ORDER BY occurred_at DESC
     LIMIT $2`,
    [manuscriptId, limit]
  ).catch(() => [])

  return { manuscript_id: manuscriptId, events }
}

async function getQueueStats(journalId: string) {
  const counts = await sql<{ status: string; count: string }>(
    `SELECT status, COUNT(*) AS count
     FROM manuscript.manuscripts
     WHERE journal_id = $1
     GROUP BY status`,
    [journalId]
  ).catch(() => [])

  const recentEvents = await sql<{ event_type: string; count: string }>(
    `SELECT event_type, COUNT(*) AS count
     FROM history.events
     WHERE journal_id = $1
       AND occurred_at > now() - INTERVAL '7 days'
     GROUP BY event_type
     ORDER BY count DESC
     LIMIT 10`,
    [journalId]
  ).catch(() => [])

  return { manuscript_counts_by_status: counts, events_last_7_days: recentEvents }
}

function stageMutations(mutations: StagedMutation[]) {
  const summary = mutations.map((m, i) => `${i + 1}. ${m.description}`).join("\n")
  return { staged: mutations, summary }
}

async function commitMutations(journalId: string, mutations: StagedMutation[]) {
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
  if (committed > 0) {
    await sql(
      `INSERT INTO history.events (journal_id, event_type, actor_type, payload)
       VALUES ($1, 'troubleshooting.fix_applied', 'agent', $2)`,
      [journalId, JSON.stringify({ mutations_applied: committed, mutations_failed: errors.length })]
    ).catch(() => {})
  }
  return { committed, errors }
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const tools: Anthropic.Tool[] = [
  {
    name: "get_queue_stats",
    description:
      "Get a count of manuscripts by status and a summary of recent event activity for this journal. " +
      "Use this as the starting point to understand the overall system state.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "query_manuscripts",
    description:
      "List manuscripts for this journal. Filter by status to narrow the list. " +
      "Returns metadata and any gates with no recorded outcome (potential stuck points).",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", description: "Optional status filter, e.g. 'submitted', 'under_review'" },
        limit: { type: "number", description: "Max results to return. Defaults to 20." },
      },
      required: [],
    },
  },
  {
    name: "get_manuscript_details",
    description:
      "Get the full current state of a manuscript: metadata, active gate states, reviewer invitations, " +
      "and the five most recent events. Use to pinpoint where a specific manuscript is stuck.",
    input_schema: {
      type: "object" as const,
      properties: {
        manuscript_id: { type: "string", description: "The manuscript UUID" },
      },
      required: ["manuscript_id"],
    },
  },
  {
    name: "get_manuscript_history",
    description:
      "Fetch the full event log for a manuscript from the history table, most recent first. " +
      "Use to reconstruct the sequence of events and identify where things went wrong.",
    input_schema: {
      type: "object" as const,
      properties: {
        manuscript_id: { type: "string", description: "The manuscript UUID" },
        limit: { type: "number", description: "Number of events to return. Defaults to 25." },
      },
      required: ["manuscript_id"],
    },
  },
  {
    name: "stage_mutations",
    description:
      "Stage corrective Cypher mutations without applying them. " +
      "Show the admin a plain-language summary and wait for explicit confirmation before committing.",
    input_schema: {
      type: "object" as const,
      properties: {
        mutations: {
          type: "array",
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
    name: "commit_mutations",
    description:
      "Apply staged corrective mutations. " +
      "ONLY call this after the admin has explicitly confirmed they want the fix applied.",
    input_schema: {
      type: "object" as const,
      properties: {
        mutations: {
          type: "array",
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

const SYSTEM_PROMPT = `You are an AI troubleshooting assistant for an academic journal editorial management system. Your job is to help system administrators diagnose and fix problems with manuscript workflows, data integrity, and system configuration.

## Your role
- Diagnose problems reported by admins ("manuscript X is stuck", "a reviewer never got their invitation", "a decision hasn't gone out")
- Query the system to find root causes
- Propose and apply targeted fixes, with explicit admin confirmation before any change

## Diagnostic approach
Always investigate before proposing a fix:
1. Call get_queue_stats for an overview of the current system state
2. Call query_manuscripts (with a status filter if the admin mentions one) to find affected manuscripts
3. Call get_manuscript_details on the specific manuscript to see gate states, reviewer invitations, and recent events
4. Call get_manuscript_history to see the full event sequence and identify where the workflow diverged from expectations
5. Explain clearly what you found: which step is stuck, what was expected, what actually happened, and why

## Common problems and fixes
- **Gate stuck with no outcome** — SET g.outcome = 'PASS' (or the correct outcome) on the Gate node to unblock the workflow
- **Missing reviewer invitation** — CREATE the missing [:INVITED_TO_REVIEW] relationship between Reviewer and Manuscript nodes
- **Manuscript in wrong status** — SET m.status = 'correct_status' on the Manuscript node; log a corrective history event
- **Checklist not evaluated** — Check recent_events; if 'checklist.evaluated' is missing, advise admin to use the Journal Admin checklist page
- **Workflow not defined** — No WorkflowDefinition node found; advise admin to use the Workflow Config page to define one

## Cypher syntax rules (Apache AGE dialect)
- Single quotes only inside Cypher: {name: 'value'} NOT {name: "value"}
- No SQL functions inside Cypher (no gen_random_uuid(), no now())
- One MATCH...SET or CREATE per mutation object
- Do NOT wrap queries in SELECT * FROM cypher(...)

## Confirm-before-commit rule
NEVER call commit_mutations without first calling stage_mutations and receiving explicit admin confirmation ("yes", "apply it", "go ahead", "confirm"). Do NOT re-stage after confirmation — proceed directly to commit_mutations.

## Tone
Be direct and practical. Lead with the diagnosis ("The manuscript is stuck at the review gate because..."), then offer the fix. Avoid graph/database jargon unless the admin asks for technical details. Admins are editorial domain experts, not engineers.`

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const { deny } = await requireSystemAdmin()
  if (deny) return deny

  const { messages, journalId } = await req.json() as { messages: Message[]; journalId: string }

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

          let textBuffer = ""
          const toolUses: Anthropic.ToolUseBlock[] = []

          for (const block of response.content) {
            if (block.type === "text") textBuffer += block.text
            else if (block.type === "tool_use") toolUses.push(block)
          }

          if (textBuffer) emit({ type: "text", content: textBuffer })
          if (toolUses.length === 0) break

          conversationMessages.push({ role: "assistant", content: response.content })

          const toolResults: Anthropic.ToolResultBlockParam[] = []

          for (const toolUse of toolUses) {
            emit({ type: "tool_use", name: toolUse.name, input: toolUse.input })

            let result: unknown
            try {
              const input = toolUse.input as Record<string, unknown>
              switch (toolUse.name) {
                case "get_queue_stats":
                  result = await getQueueStats(journalId)
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
