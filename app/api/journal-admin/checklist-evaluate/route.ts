import Anthropic from "@anthropic-ai/sdk"
import { sql } from "@/lib/graph"
import { requireJournalRole } from "@/lib/api-auth"

const client = new Anthropic()

interface ManuscriptRow {
  id: string
  title: string
  abstract: string | null
  subject_area: string | null
  manuscript_type: string
  journal_name: string
  journal_id: string
  author_name: string
}

interface ChecklistItem {
  key: string
  label: string
  status: "pass" | "fail" | "na" | "needs_review"
  confidence: number
  note: string
}

interface ChecklistResult {
  items: ChecklistItem[]
  overall: "pass" | "fail" | "needs_human_review"
  summary: string
}

const evaluateTool: Anthropic.Tool = {
  name: "record_checklist_evaluation",
  description:
    "Record the result of evaluating each admin checklist item for this manuscript submission. " +
    "Use 'na' (not applicable) when a check genuinely cannot apply (e.g. no figures present, so figure format check is NA). " +
    "Use 'needs_review' when evidence is ambiguous and a human should verify. " +
    "Set confidence 0–1 where 1 = completely certain.",
  input_schema: {
    type: "object" as const,
    required: ["items", "overall", "summary"],
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          required: ["key", "status", "confidence", "note"],
          properties: {
            key: { type: "string" },
            status: {
              type: "string",
              enum: ["pass", "fail", "na", "needs_review"],
            },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            note: { type: "string", description: "One-sentence explanation of the evaluation." },
          },
        },
      },
      overall: {
        type: "string",
        enum: ["pass", "fail", "needs_human_review"],
        description:
          "pass = all required items pass; fail = one or more required items fail; needs_human_review = confidence too low on one or more items.",
      },
      summary: {
        type: "string",
        description: "Two-sentence plain-language summary for the journal admin.",
      },
    },
  },
}

export async function POST(req: Request) {
  const { manuscriptId } = await req.json()

  if (!manuscriptId) {
    return Response.json({ error: "manuscriptId required" }, { status: 400 })
  }

  // Fetch journal_id from DB first — never trust it from the client
  const [manuscript] = await sql<ManuscriptRow>(`
    SELECT
      m.id,
      m.title,
      m.abstract,
      m.subject_area,
      m.manuscript_type,
      j.name       AS journal_name,
      j.id         AS journal_id,
      p.full_name  AS author_name
    FROM manuscript.manuscripts m
    JOIN manuscript.journals j ON j.id = m.journal_id
    JOIN manuscript.people   p ON p.id = m.submitted_by
    WHERE m.id = $1
  `, [manuscriptId])

  if (!manuscript) {
    return Response.json({ error: "Manuscript not found" }, { status: 404 })
  }

  // Verify caller has an editorial role on this journal
  const { deny } = await requireJournalRole(
    manuscript.journal_id,
    ["assistant_editor", "editor", "editor_in_chief", "editorial_support", "journal_admin"]
  )
  if (deny) return deny

  const prompt = `You are the admin checklist evaluator for ${manuscript.journal_name}, an academic journal.

A manuscript has been submitted and you must evaluate each item on the admin checklist. You only have access to the manuscript metadata (title, abstract, type, subject area, author name) — you cannot see the actual files. Make your best assessment from available information and set confidence accordingly.

Manuscript details:
- Title: ${manuscript.title}
- Author: ${manuscript.author_name}
- Type: ${manuscript.manuscript_type.replace(/_/g, " ")}
- Subject area: ${manuscript.subject_area ?? "not specified"}
- Abstract: ${manuscript.abstract ?? "not provided"}

Admin checklist items to evaluate:
1. key="figure_format" — Figure format meets requirements (300 dpi). Mark NA if the abstract mentions no figures.
2. key="coi_form" — Conflict of interest form submitted. Based on abstract context, assess whether COI declaration seems applicable.
3. key="irb_requirements" — IRB/ethics requirements verified. Only applicable to research involving human subjects or animal studies.
4. key="cover_letter" — Cover letter submitted. Without file access, this is inherently uncertain — set needs_review unless context strongly indicates presence or absence.
5. key="author_info" — All author and institution information complete. Assess whether the submission metadata appears complete.

Call record_checklist_evaluation with your evaluations.`

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    tools: [evaluateTool],
    tool_choice: { type: "any" },
    messages: [{ role: "user", content: prompt }],
  })

  const toolUse = response.content.find((b) => b.type === "tool_use")
  if (!toolUse || toolUse.type !== "tool_use") {
    return Response.json({ error: "Model did not call evaluation tool" }, { status: 500 })
  }

  const result = toolUse.input as ChecklistResult

  // Persist to history.events
  await sql(
    `INSERT INTO history.events (journal_id, manuscript_id, event_type, actor_type, payload)
     VALUES ($1, $2, 'checklist.evaluated', 'agent', $3)`,
    [
      manuscript.journal_id,
      manuscriptId,
      JSON.stringify({ ...result, model: "claude-opus-4-6" }),
    ]
  )

  return Response.json(result)
}
