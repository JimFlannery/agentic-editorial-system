"use client"

import { useState, useTransition } from "react"
import { respondToInvitation, submitReview } from "./actions"

const RECOMMENDATIONS = [
  { value: "accept",           label: "Accept" },
  { value: "minor_revision",   label: "Minor Revision" },
  { value: "major_revision",   label: "Major Revision" },
  { value: "reject",           label: "Reject" },
]

interface PriorReview {
  summary: string
  recommendation: string
  occurred_at: string
}

interface Props {
  acronym: string
  manuscriptId: string
  journalId: string
  invitationStatus: string
  priorReview: PriorReview | null
}

export default function ReviewForm({
  acronym,
  manuscriptId,
  journalId,
  invitationStatus,
  priorReview,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleRespond(response: "accepted" | "declined") {
    setError(null)
    startTransition(async () => {
      try {
        await respondToInvitation(acronym, manuscriptId, journalId, response)
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred.")
      }
    })
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        await submitReview(acronym, manuscriptId, journalId, fd)
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred.")
      }
    })
  }

  // Invitation pending — accept or decline
  if (invitationStatus === "invited") {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-8 text-center">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
          You have been invited to review this manuscript
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 max-w-sm mx-auto">
          Please let us know whether you are able to complete this review by the deadline.
        </p>
        {error && (
          <p className="text-sm text-red-500 dark:text-red-400 mb-4">{error}</p>
        )}
        <div className="flex justify-center gap-3">
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleRespond("accepted")}
            className="px-5 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-50 transition-colors"
          >
            Accept
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleRespond("declined")}
            className="px-5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
          >
            Decline
          </button>
        </div>
      </div>
    )
  }

  // Already submitted
  if (invitationStatus === "completed" || priorReview) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-6 space-y-5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Review submitted</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800">
            Completed
          </span>
        </div>
        {priorReview && (
          <>
            <div>
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1">Recommendation</p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 capitalize">
                {priorReview.recommendation.replace(/_/g, " ")}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1">Summary</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap">
                {priorReview.summary}
              </p>
            </div>
          </>
        )}
        <p className="text-xs text-zinc-400">Thank you for your contribution to the peer review process.</p>
      </div>
    )
  }

  // Declined
  if (invitationStatus === "declined") {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-8 text-center">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">You declined this review invitation.</p>
      </div>
    )
  }

  // Accepted — show the review form
  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-6 space-y-5">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Submit Your Review</h2>

        {/* Recommendation */}
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
            Recommendation <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {RECOMMENDATIONS.map((r) => (
              <label key={r.value} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="radio"
                  name="recommendation"
                  value={r.value}
                  required
                  className="accent-zinc-900 dark:accent-zinc-100"
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100">
                  {r.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
            Summary <span className="text-red-500">*</span>
          </label>
          <textarea
            name="summary"
            required
            rows={5}
            placeholder="Provide an overall assessment of the manuscript's strengths, weaknesses, originality, and significance."
            className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 resize-y"
          />
        </div>

        {/* Comments to author */}
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
            Comments to Author
          </label>
          <textarea
            name="comments_author"
            rows={4}
            placeholder="Specific comments intended for the author(s). These will be shared."
            className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 resize-y"
          />
        </div>

        {/* Confidential comments to editor */}
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
            Confidential Comments to Editor
          </label>
          <textarea
            name="comments_editor"
            rows={3}
            placeholder="Confidential remarks for the editor only. Not shared with the author."
            className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 resize-y"
          />
        </div>

        {error && (
          <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="px-5 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-50 transition-colors"
          >
            {isPending ? "Submitting…" : "Submit Review"}
          </button>
        </div>
      </div>
    </form>
  )
}
