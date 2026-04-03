"use client"

import { useState, useTransition } from "react"
import { passToEic, unsubmitManuscript, rejectWithTransfer } from "./actions"

interface ChecklistItem {
  key: string
  label?: string
  status: "pass" | "fail" | "na" | "needs_review" | "pending"
  confidence?: number
  note?: string
}

interface ChecklistResult {
  items: Omit<ChecklistItem, "label">[]
  overall: "pass" | "fail" | "needs_human_review"
  summary: string
}

interface Props {
  manuscriptId: string
  journalId: string
  acronym: string
  initialChecklist: ChecklistResult | null
}

const CHECKLIST_LABELS: Record<string, string> = {
  figure_format:    "Figure format meets requirements (300 dpi)",
  coi_form:         "Conflict of interest form submitted",
  irb_requirements: "IRB / ethics requirements verified",
  cover_letter:     "Cover letter submitted",
  author_info:      "All author and institution information complete",
}

const INITIAL_ITEMS: ChecklistItem[] = Object.keys(CHECKLIST_LABELS).map((key) => ({
  key,
  label: CHECKLIST_LABELS[key],
  status: "pending",
}))

function statusBadge(status: ChecklistItem["status"]) {
  const base = "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded"
  switch (status) {
    case "pass":
      return <span className={`${base} bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300`}>Pass</span>
    case "fail":
      return <span className={`${base} bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300`}>Fail</span>
    case "na":
      return <span className={`${base} bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400`}>N/A</span>
    case "needs_review":
      return <span className={`${base} bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300`}>Review needed</span>
    default:
      return <span className={`${base} bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500`}>Pending</span>
  }
}

function overallBanner(overall: "pass" | "fail" | "needs_human_review") {
  if (overall === "pass") {
    return (
      <div className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-800 dark:text-green-300">
        All checklist items passed — manuscript is ready to send to the EIC.
      </div>
    )
  }
  if (overall === "fail") {
    return (
      <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-800 dark:text-red-300">
        One or more checklist items failed. Review the items below and choose an action.
      </div>
    )
  }
  return (
    <div className="rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
      AI confidence is low on one or more items. Please review and override as needed before taking action.
    </div>
  )
}

export default function ChecklistPanel({ manuscriptId, journalId, acronym, initialChecklist }: Props) {
  const [checklist, setChecklist] = useState<ChecklistResult | null>(initialChecklist)
  const [evaluating, setEvaluating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [isPending, startTransition] = useTransition()

  const [showUnsubmit, setShowUnsubmit] = useState(false)
  const [unsubmitReason, setUnsubmitReason] = useState("")
  const [showReject, setShowReject] = useState(false)
  const [transferTarget, setTransferTarget] = useState("")

  const items: ChecklistItem[] = checklist
    ? checklist.items.map((i) => ({ ...i, label: CHECKLIST_LABELS[i.key] ?? i.key }))
    : INITIAL_ITEMS

  async function runEvaluation() {
    setEvaluating(true)
    setError(null)
    try {
      const res = await fetch("/api/journal-admin/checklist-evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manuscriptId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const result: ChecklistResult = await res.json()
      setChecklist(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Evaluation failed")
    } finally {
      setEvaluating(false)
    }
  }

  function overrideItem(key: string, status: ChecklistItem["status"]) {
    if (!checklist) return
    setChecklist({
      ...checklist,
      items: checklist.items.map((i) =>
        i.key === key ? { ...i, status, confidence: 1, note: "Manually overridden by admin." } : i
      ),
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">Admin Checklist</h2>
        <button
          onClick={runEvaluation}
          disabled={evaluating}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-50 transition-colors"
        >
          {evaluating ? (
            <>
              <span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Evaluating…
            </>
          ) : (
            checklist ? "Re-run AI Evaluation" : "Run AI Evaluation"
          )}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {checklist?.summary && (
        <div className="mb-4 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">AI summary: </span>
          {checklist.summary}
        </div>
      )}

      {checklist && <div className="mb-4">{overallBanner(checklist.overall)}</div>}

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden mb-6">
        {items.map((item, idx) => (
          <div
            key={item.key}
            className={`px-4 py-3 flex items-start gap-3 ${idx !== items.length - 1 ? "border-b border-zinc-100 dark:border-zinc-800" : ""}`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm text-zinc-800 dark:text-zinc-200 mb-1">{item.label}</p>
              {item.note && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.note}</p>
              )}
              {item.confidence !== undefined && item.status !== "pending" && (
                <p className="text-xs text-zinc-400 mt-0.5">
                  AI confidence: {Math.round(item.confidence * 100)}%
                </p>
              )}
            </div>
            <div className="shrink-0 flex items-center gap-2">
              {statusBadge(item.status)}
              {checklist && (
                <select
                  className="text-xs text-zinc-500 dark:text-zinc-400 bg-transparent border-none cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-200"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) overrideItem(item.key, e.target.value as ChecklistItem["status"])
                  }}
                  title="Override this item"
                >
                  <option value="">Override</option>
                  <option value="pass">Pass</option>
                  <option value="fail">Fail</option>
                  <option value="na">N/A</option>
                  <option value="needs_review">Needs review</option>
                </select>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-zinc-100 dark:border-zinc-800 pt-5">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
          Take action
        </p>
        <div className="flex flex-wrap gap-3">
          <form action={passToEic.bind(null, acronym, manuscriptId, journalId)}>
            <button
              type="submit"
              disabled={isPending || !checklist}
              className="text-sm font-medium px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 transition-colors"
            >
              Pass to EIC
            </button>
          </form>

          <button
            onClick={() => setShowUnsubmit(true)}
            disabled={isPending}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900 disabled:opacity-40 transition-colors"
          >
            Unsubmit
          </button>

          <button
            onClick={() => setShowReject(true)}
            disabled={isPending}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900 disabled:opacity-40 transition-colors"
          >
            Reject with Transfer
          </button>
        </div>

        {!checklist && (
          <p className="mt-2 text-xs text-zinc-400">Run AI Evaluation before passing to EIC.</p>
        )}
      </div>

      {showUnsubmit && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-md shadow-xl">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Unsubmit Manuscript</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              The manuscript will be returned to the author as a revision request. Provide a reason.
            </p>
            <textarea
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 px-3 py-2 mb-4 resize-none"
              rows={4}
              placeholder="Explain what the author needs to correct…"
              value={unsubmitReason}
              onChange={(e) => setUnsubmitReason(e.target.value)}
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowUnsubmit(false)}
                className="text-sm px-4 py-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  startTransition(() => unsubmitManuscript(acronym, manuscriptId, journalId, unsubmitReason))
                }}
                disabled={!unsubmitReason.trim() || isPending}
                className="text-sm font-medium px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-40 transition-colors"
              >
                Unsubmit
              </button>
            </div>
          </div>
        </div>
      )}

      {showReject && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-md shadow-xl">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Reject with Transfer</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              The manuscript will be rejected. Optionally suggest a transfer target journal.
            </p>
            <input
              type="text"
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 px-3 py-2 mb-4"
              placeholder="Transfer target journal (optional)"
              value={transferTarget}
              onChange={(e) => setTransferTarget(e.target.value)}
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowReject(false)}
                className="text-sm px-4 py-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  startTransition(() => rejectWithTransfer(acronym, manuscriptId, journalId, transferTarget))
                }}
                disabled={isPending}
                className="text-sm font-medium px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 transition-colors"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
