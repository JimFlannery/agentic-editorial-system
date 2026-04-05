"use client"

import { useState, useTransition } from "react"
import { sendDecision, type SubmittedReview } from "./actions"

const DECISIONS = [
  { value: "accept",          label: "Accept" },
  { value: "minor_revision",  label: "Minor Revision" },
  { value: "major_revision",  label: "Major Revision" },
  { value: "reject",          label: "Reject" },
]

const RECOMMENDATION_LABEL: Record<string, string> = {
  accept:          "Accept",
  minor_revision:  "Minor Revision",
  major_revision:  "Major Revision",
  reject:          "Reject",
}

const RECOMMENDATION_COLOUR: Record<string, string> = {
  accept:         "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800",
  minor_revision: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800",
  major_revision: "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border border-orange-200 dark:border-orange-800",
  reject:         "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800",
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

interface Props {
  acronym: string
  manuscriptId: string
  journalId: string
  reviews: SubmittedReview[]
}

export default function DecisionPanel({ acronym, manuscriptId, journalId, reviews }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const [decision, setDecision] = useState("")
  const [letter, setLetter] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!decision) { setError("Please select a decision."); return }
    if (!letter.trim()) { setError("Decision letter is required."); return }
    startTransition(async () => {
      try {
        await sendDecision(acronym, manuscriptId, journalId, decision, letter)
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred.")
      }
    })
  }

  return (
    <div className="mt-8 space-y-5">
      {/* Reviewer reports */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">
            Reviewer Reports <span className="text-muted-foreground font-normal">({reviews.length})</span>
          </h2>
        </div>

        {reviews.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-muted-foreground">No reviews submitted yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {reviews.map((r, i) => {
              const isOpen = expanded === i
              const recColour = RECOMMENDATION_COLOUR[r.recommendation] ?? "bg-zinc-100 text-zinc-500"
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : i)}
                    className="w-full text-left flex items-center justify-between gap-4 px-5 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        Reviewer {i + 1}
                        <span className="ml-1.5 text-xs text-muted-foreground font-normal">· {formatDate(r.occurred_at)}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${recColour}`}>
                        {RECOMMENDATION_LABEL[r.recommendation] ?? r.recommendation}
                      </span>
                      <span className="text-muted-foreground text-xs">{isOpen ? "▲" : "▼"}</span>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 space-y-3 border-t border-border">
                      <div className="pt-3">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Summary</p>
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{r.summary}</p>
                      </div>
                      {r.comments_author && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Comments to Author</p>
                          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{r.comments_author}</p>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Decision form */}
      <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Send Decision</h2>
        </div>
        <div className="px-5 py-5 space-y-5">
          {/* Decision radio */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Decision <span className="text-red-500">*</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DECISIONS.map((d) => (
                <label key={d.value} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="radio"
                    name="decision"
                    value={d.value}
                    checked={decision === d.value}
                    onChange={() => setDecision(d.value)}
                    className="accent-zinc-900 dark:accent-zinc-100"
                  />
                  <span className="text-sm text-foreground group-hover:text-foreground">
                    {d.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Decision letter */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Letter to Author <span className="text-red-500">*</span>
            </label>
            <textarea
              value={letter}
              onChange={(e) => setLetter(e.target.value)}
              rows={8}
              placeholder="Compose the decision letter to the corresponding author…"
              className="w-full text-sm border border-input rounded-lg px-3 py-2 bg-card text-foreground placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 resize-y"
            />
          </div>

          {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-50 transition-colors"
            >
              {isPending ? "Sending…" : "Send Decision"}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
